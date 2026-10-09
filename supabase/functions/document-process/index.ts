import { withSupabase } from "@supabase/server";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { createPageAwareChunks, normalizeExtractedText, type ExtractedPage } from "../_shared/rag/chunking.ts";
import { createEmbeddings, EmbeddingProviderError } from "../_shared/rag/openai.ts";

const BUCKET = "fontex-documents";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProcessingClaim = {
  job_id: string;
  document_id: string;
  status: "pending" | "processing" | "ready" | "failed";
  phase: "extracting" | "embedding" | "complete";
  ready: boolean;
  lease_token: string | null;
  storage_path?: string;
  content_sha256?: string;
  expected_pages?: number;
  embedding_model?: string;
  embedding_dimensions?: number;
  chunk_version?: string;
  max_extracted_characters?: number;
  max_chunks_per_document?: number;
  max_embedding_tokens_per_document?: number;
  target_chunk_tokens?: number;
  chunk_overlap_tokens?: number;
  embedding_batch_size?: number;
};

type PendingChunk = { id: number; content: string };

class ProcessingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly permanent = false,
  ) {
    super(message);
  }
}

function jsonError(message: string, code: string, status: number) {
  return Response.json({ message, code }, { status });
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const copied = Uint8Array.from(bytes);
  return bytesToHex(await crypto.subtle.digest("SHA-256", copied.buffer));
}

async function extractPages(data: Uint8Array, maximumCharacters: number) {
  const loadingTask = getDocument({
    data,
    stopAtErrors: true,
    useSystemFonts: true,
  });
  let pdf: Awaited<typeof loadingTask.promise> | null = null;
  try {
    pdf = await loadingTask.promise;
    const pages: ExtractedPage[] = [];
    let totalCharacters = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ disableNormalization: false });
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      }
      page.cleanup();
      const normalized = normalizeExtractedText(text);
      totalCharacters += normalized.length;
      if (totalCharacters > maximumCharacters) {
        throw new ProcessingError("El PDF supera el límite de texto extraíble.", "extracted_text_limit", 422, true);
      }
      pages.push({ pageNumber, text: normalized });
    }
    return { pageCount: pdf.numPages, pages, totalCharacters };
  } catch (error) {
    if (error instanceof ProcessingError) throw error;
    throw new ProcessingError("No fue posible extraer texto del PDF.", "pdf_extraction_failed", 422, true);
  } finally {
    await loadingTask.destroy();
  }
}

function parseClaim(value: unknown): ProcessingClaim {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProcessingError("Supabase devolvió un trabajo inválido.", "invalid_processing_claim", 500);
  }
  return value as ProcessingClaim;
}

function assertActiveClaim(claim: ProcessingClaim): asserts claim is ProcessingClaim & {
  lease_token: string;
  storage_path: string;
  content_sha256: string;
  expected_pages: number;
  embedding_model: string;
  embedding_dimensions: number;
  max_extracted_characters: number;
  max_chunks_per_document: number;
  max_embedding_tokens_per_document: number;
  target_chunk_tokens: number;
  chunk_overlap_tokens: number;
  embedding_batch_size: number;
} {
  if (
    !claim.lease_token || !claim.storage_path || !claim.content_sha256
    || !Number.isInteger(claim.expected_pages) || !claim.embedding_model
    || !Number.isInteger(claim.embedding_dimensions)
    || !Number.isInteger(claim.max_extracted_characters)
    || !Number.isInteger(claim.max_chunks_per_document)
    || !Number.isInteger(claim.max_embedding_tokens_per_document)
    || !Number.isInteger(claim.target_chunk_tokens)
    || !Number.isInteger(claim.chunk_overlap_tokens)
    || !Number.isInteger(claim.embedding_batch_size)
  ) {
    throw new ProcessingError("La configuración del trabajo está incompleta.", "invalid_processing_claim", 500);
  }
}

function databaseError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("already active")) return new ProcessingError("El documento ya se está procesando.", "processing_busy", 409);
  if (normalized.includes("retry limit")) return new ProcessingError("El documento agotó sus reintentos de indexación.", "retry_limit", 409, true);
  if (normalized.includes("concurrent")) return new ProcessingError("Ya tienes otro documento en procesamiento.", "concurrency_limit", 429);
  if (normalized.includes("owned document")) return new ProcessingError("Sólo el propietario puede indexar este documento.", "not_document_owner", 403, true);
  return new ProcessingError("No fue posible reservar el procesamiento.", "processing_claim_failed", 500);
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return jsonError("Método no permitido.", "METHOD_NOT_ALLOWED", 405);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("El cuerpo debe ser JSON válido.", "INVALID_JSON", 400);
    }
    const documentId = body && typeof body === "object" ? Reflect.get(body, "documentId") : null;
    if (typeof documentId !== "string" || !UUID_PATTERN.test(documentId)) {
      return jsonError("El documento no es válido.", "INVALID_DOCUMENT", 400);
    }

    const claimResult = await context.supabase.rpc("claim_document_processing", { target_document_id: documentId });
    if (claimResult.error) {
      const error = databaseError(claimResult.error.message);
      return jsonError(error.message, error.code, error.status);
    }

    let claim: ProcessingClaim;
    try {
      claim = parseClaim(claimResult.data);
      if (claim.ready) {
        return Response.json({ documentId, jobId: claim.job_id, status: "ready", complete: true });
      }
      assertActiveClaim(claim);
    } catch (error) {
      const processingError = error instanceof ProcessingError ? error : new ProcessingError("Trabajo inválido.", "invalid_processing_claim", 500);
      return jsonError(processingError.message, processingError.code, processingError.status);
    }

    const fail = async (error: ProcessingError | EmbeddingProviderError) => {
      const failure = await context.supabaseAdmin.rpc("internal_fail_document_processing", {
        target_job_id: claim.job_id,
        target_lease_token: claim.lease_token,
        target_failure_code: error.code,
        target_failure_detail: error.message,
        permanent_failure: error instanceof ProcessingError ? error.permanent : !error.retryable,
      });
      if (failure.error) console.error(`RAG failure persistence failed: job_id=${claim.job_id}`);
    };

    try {
      if (claim.phase === "extracting") {
        const download = await context.supabaseAdmin.storage.from(BUCKET).download(claim.storage_path);
        if (download.error || !download.data) {
          throw new ProcessingError("No fue posible leer el PDF privado.", "storage_download_failed", 502);
        }
        const bytes = new Uint8Array(await download.data.arrayBuffer());
        if (await sha256(bytes) !== claim.content_sha256) {
          throw new ProcessingError("El PDF almacenado no coincide con su hash registrado.", "stored_hash_mismatch", 422, true);
        }

        const extraction = await extractPages(bytes, claim.max_extracted_characters);
        if (extraction.pageCount !== claim.expected_pages) {
          throw new ProcessingError("El número real de páginas no coincide con la carga.", "page_count_mismatch", 422, true);
        }
        if (extraction.totalCharacters < 1) {
          throw new ProcessingError("El PDF no contiene texto seleccionable.", "no_selectable_text", 422, true);
        }

        const chunks = createPageAwareChunks(extraction.pages, claim.target_chunk_tokens, claim.chunk_overlap_tokens);
        const estimatedTokens = chunks.reduce((total, chunk) => total + chunk.estimatedTokens, 0);
        if (!chunks.length) {
          throw new ProcessingError("El PDF no produjo fragmentos recuperables.", "no_extractable_chunks", 422, true);
        }
        if (chunks.length > claim.max_chunks_per_document || estimatedTokens > claim.max_embedding_tokens_per_document) {
          throw new ProcessingError("El PDF supera el presupuesto de indexación.", "indexing_budget_exceeded", 422, true);
        }

        const storedChunks = await Promise.all(chunks.map(async (chunk) => ({
          chunk_index: chunk.chunkIndex,
          page_start: chunk.pageStart,
          page_end: chunk.pageEnd,
          content: chunk.content,
          content_sha256: await sha256(chunk.content),
          estimated_tokens: chunk.estimatedTokens,
        })));
        const storeResult = await context.supabaseAdmin.rpc("internal_store_extracted_chunks", {
          target_job_id: claim.job_id,
          target_lease_token: claim.lease_token,
          actual_page_count: extraction.pageCount,
          chunks: storedChunks,
        });
        if (storeResult.error) {
          throw new ProcessingError("No fue posible guardar los fragmentos extraídos.", "chunk_persistence_failed", 500);
        }
      }

      const pendingResult = await context.supabaseAdmin
        .from("document_chunks")
        .select("id, content")
        .eq("job_id", claim.job_id)
        .is("embedding", null)
        .order("chunk_index")
        .limit(claim.embedding_batch_size);
      if (pendingResult.error || !pendingResult.data?.length) {
        throw new ProcessingError("El trabajo no contiene un lote de embeddings pendiente.", "missing_embedding_batch", 500);
      }
      const pendingChunks = pendingResult.data as PendingChunk[];
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) throw new ProcessingError("El proveedor de embeddings no está configurado.", "embedding_not_configured", 503);

      const configuredModel = Deno.env.get("EMBEDDING_MODEL") ?? "text-embedding-3-small";
      const configuredDimensions = Number(Deno.env.get("EMBEDDING_DIMENSIONS") ?? "1536");
      if (configuredModel !== claim.embedding_model || configuredDimensions !== claim.embedding_dimensions) {
        throw new ProcessingError("La configuración de embeddings no coincide con el índice.", "embedding_config_mismatch", 500, true);
      }

      const embedded = await createEmbeddings({
        apiKey,
        model: configuredModel,
        dimensions: configuredDimensions,
        inputs: pendingChunks.map((chunk) => chunk.content),
      });
      const storeEmbeddings = await context.supabaseAdmin.rpc("internal_store_chunk_embeddings", {
        target_job_id: claim.job_id,
        target_lease_token: claim.lease_token,
        embeddings: pendingChunks.map((chunk, index) => ({
          chunk_id: chunk.id,
          embedding: embedded.embeddings[index],
        })),
        batch_embedding_tokens: embedded.tokenCount,
      });
      if (storeEmbeddings.error || !storeEmbeddings.data) {
        throw new ProcessingError("No fue posible confirmar el lote de embeddings.", "embedding_persistence_failed", 500);
      }

      const result = storeEmbeddings.data as Record<string, unknown>;
      return Response.json({
        documentId,
        jobId: claim.job_id,
        status: result.status,
        phase: result.phase,
        complete: result.complete,
        chunkCount: result.chunk_count,
        embeddedChunkCount: result.embedded_chunk_count,
      });
    } catch (error) {
      const processingError = error instanceof ProcessingError || error instanceof EmbeddingProviderError
        ? error
        : new ProcessingError("Falló el procesamiento del documento.", "processing_failed", 500);
      await fail(processingError);
      console.error(`RAG processing failed: job_id=${claim.job_id} code=${processingError.code}`);
      return jsonError(processingError.message, processingError.code, processingError.status);
    }
  }),
};
