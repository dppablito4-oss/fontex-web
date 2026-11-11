import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createEmbeddings,
  EmbeddingProviderError,
  vectorToPostgres,
} from "../_shared/rag/openai.ts";
import {
  ABSTENTION,
  buildTutorPrompt,
  parseMessages,
  parseModelOutput,
  type RetrievedChunk,
  tutorInstructions,
  type VerifiedCitation,
} from "./protocol.ts";

type Context = {
  userClaims?: { id?: string } | null;
  supabaseAdmin: SupabaseClient;
};
type Reservation = {
  event_id: string;
  max_retrieved_chunks: number;
  max_input_tokens: number;
  max_output_tokens: number;
  default_model: string;
  reasoning_effort: string;
};
type ModelResponse = {
  status?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    output_tokens_details?: { reasoning_tokens?: number };
  };
};
class TutorError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
  }
}
const DEFAULT_MODEL = "gpt-6-astra";
const jsonError = (message: string, code: string, status: number) =>
  Response.json({ message, code }, { status });

export function createTutorHandler(env: (name: string) => string | undefined) {
  return async (request: Request, context: Context): Promise<Response> => {
    const userId = context.userClaims?.id;
    if (!userId) {
      return jsonError("Se requiere una sesión válida.", "AUTH_REQUIRED", 401);
    }
    if (request.method !== "POST" && request.method !== "GET") {
      return jsonError("Método no permitido.", "METHOD_NOT_ALLOWED", 405);
    }
    const apiKey = env("OPENAI_API_KEY")?.trim();
    if (!apiKey) {
      return jsonError(
        "El tutor no está configurado en el servidor.",
        "AI_NOT_CONFIGURED",
        503,
      );
    }
    let body: Record<string, unknown> = {};
    if (request.method === "POST") {
      try {
        const value: unknown = await request.json();
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new Error();
        }
        body = value as Record<string, unknown>;
      } catch {
        return jsonError(
          "El cuerpo debe ser un objeto JSON válido.",
          "INVALID_JSON",
          400,
        );
      }
    }
    const admin = context.supabaseAdmin;
    if (request.method === "GET" || body.action === "health") {
      const { data, error } = await admin.from("tutor_limits")
        .select("is_enabled, default_model, max_output_tokens").eq("id", 1)
        .single();
      if (error || !data?.is_enabled) {
        return jsonError(
          "El servicio de tutor está temporalmente pausado.",
          "TUTOR_PAUSED",
          503,
        );
      }
      return Response.json({
        ready: true,
        model: env("OPENAI_MODEL")?.trim() || data.default_model ||
          DEFAULT_MODEL,
        maxTokens: data.max_output_tokens,
      });
    }
    const classroomId = typeof body.classroomId === "string"
      ? body.classroomId.trim()
      : "";
    if (!classroomId) {
      return jsonError(
        "Se requiere un aula activa.",
        "CLASSROOM_REQUIRED",
        400,
      );
    }
    const messages = parseMessages(body.messages);
    if (!messages) {
      return jsonError(
        "La conversación no tiene un formato válido.",
        "INVALID_MESSAGES",
        400,
      );
    }
    const query = messages.at(-1)!.content;
    const mode = body.mode === "comparative" ? "comparative" : "strict";
    const guided = body.guided === true;
    const selectedDocumentIds = Array.isArray(body.selectedDocumentIds)
      ? body.selectedDocumentIds.filter((id: unknown): id is string =>
        typeof id === "string" && !!id.trim()
      )
      : [];
    const scope = ["private", "group", "classroom"].includes(String(body.scope))
      ? String(body.scope)
      : "all";
    let conversationId = typeof body.conversationId === "string"
      ? body.conversationId
      : null;
    let reservation: Reservation;
    try {
      const { data, error } = await admin.rpc("internal_begin_tutor_request", {
        requesting_user_id: userId,
        target_classroom_id: classroomId,
        target_conversation_id: conversationId,
        requested_mode: mode,
        requested_guided: guided,
        query_characters: query.length,
        request_idempotency_key: typeof body.idempotencyKey === "string"
          ? body.idempotencyKey
          : null,
      });
      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("hourly tutor")) {
          return jsonError(
            "Alcanzaste tu límite por hora.",
            "RATE_LIMIT_HOURLY",
            429,
          );
        }
        if (message.includes("daily tutor")) {
          return jsonError(
            "Alcanzaste tu límite por día.",
            "RATE_LIMIT_DAILY",
            429,
          );
        }
        if (message.includes("global tutor")) {
          return jsonError(
            "Se completó el presupuesto diario del piloto.",
            "PILOT_BUDGET_EXCEEDED",
            429,
          );
        }
        if (
          message.includes("concurrent") || message.includes("duplicate active")
        ) {
          return jsonError(
            "Ya tienes una consulta en proceso.",
            "CONCURRENT_REQUEST",
            429,
          );
        }
        if (message.includes("disabled")) {
          return jsonError(
            "El tutor está temporalmente pausado.",
            "SERVICE_PAUSED",
            503,
          );
        }
        if (message.includes("access denied")) {
          return jsonError(
            "No tienes acceso al aula.",
            "CLASSROOM_ACCESS_DENIED",
            403,
          );
        }
        throw error;
      }
      reservation = data as Reservation;
      if (!reservation?.event_id) throw new Error("Missing reservation");
    } catch {
      return jsonError(
        "No fue posible validar la cuota del tutor.",
        "RESERVATION_FAILED",
        503,
      );
    }

    const started = performance.now();
    let promptTokens = 0, completionTokens = 0, reasoningTokens = 0;
    let chunks: RetrievedChunk[] = [];
    let outcome: "completed" | "failed" = "failed";
    let errorCode: string | null = null;
    let response: Response;
    // Every path after a successful reservation passes through completion below.
    try {
      if (conversationId) {
        const { data, error } = await admin.from("tutor_conversations").select(
          "id",
        )
          .eq("id", conversationId).eq("user_id", userId).eq(
            "classroom_id",
            classroomId,
          ).maybeSingle();
        if (error || !data) {
          throw new TutorError(
            "La conversación ya no está disponible.",
            "CONVERSATION_ACCESS_DENIED",
            403,
          );
        }
      } else {
        const { data, error } = await admin.from("tutor_conversations").insert({
          user_id: userId,
          classroom_id: classroomId,
          title: query.length > 55 ? `${query.slice(0, 52)}…` : query,
          mode,
          guided,
          selected_document_ids: selectedDocumentIds,
        }).select("id").single();
        if (error || !data) {
          throw new TutorError(
            "No fue posible crear la conversación.",
            "CONVERSATION_CREATE_FAILED",
            500,
          );
        }
        conversationId = data.id;
      }
      const embeddingModel = env("EMBEDDING_MODEL") ?? "text-embedding-3-small";
      const embedding = await createEmbeddings({
        apiKey,
        model: embeddingModel,
        dimensions: Number(env("EMBEDDING_DIMENSIONS") ?? "1536"),
        inputs: [query],
      });
      promptTokens += embedding.tokenCount;
      const search = await admin.rpc("internal_search_tutor_chunks", {
        requesting_user_id: userId,
        target_classroom_id: classroomId,
        search_query: query,
        query_embedding: vectorToPostgres(embedding.embeddings[0]),
        selected_document_ids: selectedDocumentIds.length
          ? selectedDocumentIds
          : null,
        requested_scope: scope,
        requested_match_count: reservation.max_retrieved_chunks,
        requested_embedding_model: embeddingModel,
      });
      if (search.error) {
        throw new TutorError(
          "No se pudieron consultar las fuentes.",
          "RETRIEVAL_FAILED",
          503,
        );
      }
      const instructions = tutorInstructions(mode, guided);
      const prompt = buildTutorPrompt(
        instructions,
        messages,
        (search.data ?? []) as RetrievedChunk[],
        reservation.max_input_tokens,
      );
      if (!prompt) {
        throw new TutorError(
          "La pregunta y las instrucciones superan el límite de entrada del tutor. Reduce la consulta o revisa sus límites.",
          "INPUT_BUDGET_EXCEEDED",
          400,
        );
      }
      chunks = prompt.chunks;
      let text = ABSTENTION;
      let model = "system-abstain";
      let citations: VerifiedCitation[] = [];
      if (mode !== "strict" || chunks.length) {
        model = env("OPENAI_MODEL")?.trim() || reservation.default_model ||
          DEFAULT_MODEL;
        let upstream: Response;
        try {
          upstream = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              instructions,
              input: prompt.input,
              reasoning: { effort: reservation.reasoning_effort },
              max_output_tokens: reservation.max_output_tokens,
              store: false,
            }),
            signal: AbortSignal.timeout(45_000),
          });
        } catch {
          throw new TutorError(
            "No se pudo conectar con el proveedor de IA.",
            "AI_NETWORK_ERROR",
            502,
          );
        }
        if (!upstream.ok) {
          throw new TutorError(
            "El proveedor de IA no pudo completar la respuesta.",
            "AI_UPSTREAM_ERROR",
            502,
          );
        }
        const payload = await upstream.json() as ModelResponse;
        promptTokens += payload.usage?.input_tokens ?? 0;
        completionTokens += payload.usage?.output_tokens ?? 0;
        reasoningTokens +=
          payload.usage?.output_tokens_details?.reasoning_tokens ?? 0;
        const raw = payload.output?.flatMap((item) => item.content ?? [])
          .filter((part) => part.type === "output_text").map((part) =>
            part.text ?? ""
          ).join("\n").trim();
        if (!raw || payload.status !== "completed") {
          throw new TutorError(
            "La IA no devolvió una respuesta completa.",
            "AI_EMPTY_RESPONSE",
            502,
          );
        }
        const parsed = parseModelOutput(raw, chunks);
        if (mode === "strict" && (!parsed || !parsed.citations.length)) {
          model = "system-abstain";
        } else {
          if (!parsed) {
            throw new TutorError(
              "La IA no devolvió un formato válido.",
              "AI_INVALID_RESPONSE",
              502,
            );
          }
          text = parsed.answer;
          citations = parsed.citations;
        }
      }
      const stored = await admin.rpc("internal_store_tutor_exchange", {
        requesting_user_id: userId,
        target_conversation_id: conversationId,
        question: query,
        answer: text,
        response_model: model,
        response_metadata: {
          mode,
          guided,
          abstained: model === "system-abstain",
          citationCount: citations.length,
          retrievedCount: chunks.length,
          estimatedInputTokens: prompt.estimatedInputTokens,
        },
        cited_chunk_ids: citations.map((citation) => citation.chunkId),
      });
      if (stored.error || typeof stored.data?.message_id !== "string") {
        throw new TutorError(
          "No se pudo guardar la respuesta. Inténtalo de nuevo.",
          "EXCHANGE_SAVE_FAILED",
          503,
        );
      }
      response = Response.json({
        text,
        model,
        mode,
        guided,
        conversationId,
        messageId: stored.data.message_id,
        userMessageId: stored.data.user_message_id,
        citations,
        retrievedCount: chunks.length,
      });
      outcome = "completed";
    } catch (error) {
      const known = error instanceof TutorError ||
        error instanceof EmbeddingProviderError;
      errorCode = known ? error.code : "TUTOR_PROCESSING_ERROR";
      response = jsonError(
        known ? error.message : "No se pudo completar la consulta del tutor.",
        errorCode,
        known ? error.status : 500,
      );
    }
    let finalized = false;
    for (let attempt = 0; attempt < 2 && !finalized; attempt++) {
      try {
        const completion = await admin.rpc("internal_complete_tutor_request", {
          target_event_id: reservation.event_id,
          requesting_user_id: userId,
          result_status: outcome,
          retrieved_chunks: chunks.length,
          prompt_tokens_used: promptTokens,
          completion_tokens_used: completionTokens,
          reasoning_tokens_used: reasoningTokens,
          latency_ms_used: Math.round(performance.now() - started),
          result_error_code: errorCode,
        });
        finalized = !completion.error;
      } catch {
        /* Retry once; completion is idempotent after a lost response. */
      }
    }
    if (!finalized) {
      return jsonError(
        "No se pudo confirmar el cierre de la consulta. Intenta de nuevo más tarde.",
        "QUOTA_COMPLETION_FAILED",
        503,
      );
    }
    return response;
  };
}
