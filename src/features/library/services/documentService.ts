import { supabase } from "../../../lib/supabase/client";
import type { Database, Json } from "../../../lib/supabase/database.types";
import type {
  DocumentLimits,
  DocumentShare,
  LibraryDocument,
  PreparedPdf,
  UploadScope,
} from "../types";

const BUCKET = "fontex-documents";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase no está configurado en este entorno.");
  return supabase;
}

function readableDataError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("active copy")) return "Este PDF ya está activo en tu biblioteca.";
  if (normalized.includes("document count quota")) return "Alcanzaste el número máximo de documentos.";
  if (normalized.includes("user storage quota")) return "Alcanzaste tu cuota personal de almacenamiento.";
  if (normalized.includes("classroom storage quota")) return "El aula alcanzó su cuota de almacenamiento.";
  if (normalized.includes("global storage quota")) return "Fontex alcanzó su cuota global de almacenamiento.";
  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "No tienes permiso para realizar esa acción.";
  }
  return message;
}

async function readableFunctionError(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;
  const context: unknown = Reflect.get(error, "context");
  if (!(context instanceof Response)) return fallback;
  try {
    const payload: unknown = await context.json();
    const message: unknown = payload && typeof payload === "object" ? Reflect.get(payload, "message") : null;
    return typeof message === "string" && message.trim() ? message : fallback;
  } catch {
    return fallback;
  }
}

function parseReservation(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Supabase devolvió una reserva inválida.");
  }
  const documentId = value.document_id;
  if (typeof documentId !== "string") throw new Error("La reserva no contiene un documento válido.");
  return { documentId };
}

export async function listDocuments(classroomId?: string | null): Promise<LibraryDocument[]> {
  const client = requireSupabase();
  let query = client
    .from("documents")
    .select("id, owner_id, classroom_id, title, original_filename, mime_type, size_bytes, page_count, storage_path, status, failure_code, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (classroomId) query = query.eq("classroom_id", classroomId);

  const documentResult = await query;
  if (documentResult.error) throw new Error(readableDataError(documentResult.error.message));
  if (!documentResult.data.length) return [];

  const documentIds = documentResult.data.map((document) => document.id);
  const shareResult = await client
    .from("document_shares")
    .select("id, document_id, scope_type, classroom_id, group_id, granted_by")
    .in("document_id", documentIds);
  if (shareResult.error) throw new Error(readableDataError(shareResult.error.message));

  const sharesByDocument = new Map<string, DocumentShare[]>();
  for (const share of shareResult.data) {
    const item: DocumentShare = {
      id: share.id,
      documentId: share.document_id,
      scopeType: share.scope_type,
      classroomId: share.classroom_id,
      groupId: share.group_id,
      grantedBy: share.granted_by,
    };
    sharesByDocument.set(share.document_id, [...(sharesByDocument.get(share.document_id) ?? []), item]);
  }

  return documentResult.data.map((document) => ({
    id: document.id,
    ownerId: document.owner_id,
    classroomId: document.classroom_id,
    title: document.title,
    originalFilename: document.original_filename,
    mimeType: document.mime_type,
    sizeBytes: document.size_bytes,
    pageCount: document.page_count,
    storagePath: document.storage_path,
    status: document.status,
    failureCode: document.failure_code,
    createdAt: document.created_at,
    updatedAt: document.updated_at,
    shares: sharesByDocument.get(document.id) ?? [],
  }));
}

export async function getDocumentLimits(): Promise<DocumentLimits> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("document_limits")
    .select("max_file_bytes, max_pages, max_documents_per_user, max_bytes_per_user, max_bytes_per_classroom, max_bytes_global")
    .eq("id", 1)
    .single();
  if (error) throw new Error(readableDataError(error.message));
  return {
    maxFileBytes: data.max_file_bytes,
    maxPages: data.max_pages,
    maxDocumentsPerUser: data.max_documents_per_user,
    maxBytesPerUser: data.max_bytes_per_user,
    maxBytesPerClassroom: data.max_bytes_per_classroom,
    maxBytesGlobal: data.max_bytes_global,
  };
}

export async function uploadDocument(classroomId: string, prepared: PreparedPdf) {
  const client = requireSupabase();
  const reservation = await client.rpc("reserve_document_upload", {
    target_classroom_id: classroomId,
    document_title: prepared.title,
    source_filename: prepared.file.name,
    source_mime_type: prepared.file.type,
    source_size_bytes: prepared.file.size,
    source_page_count: prepared.pageCount,
    source_sha256: prepared.sha256,
  });
  if (reservation.error) throw new Error(readableDataError(reservation.error.message));
  const { documentId } = parseReservation(reservation.data);

  const body = new FormData();
  body.set("documentId", documentId);
  body.set("file", prepared.file, prepared.file.name);
  const invocation = await client.functions.invoke("document-upload", {
    body,
    timeout: 60_000,
  });
  if (invocation.error) {
    throw new Error(await readableFunctionError(invocation.error, "No fue posible cargar el PDF."));
  }
  return documentId;
}

export async function shareDocument(
  document: Pick<LibraryDocument, "id" | "classroomId">,
  scope: Exclude<UploadScope, { type: "private" }>,
) {
  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["document_shares"]["Insert"] = scope.type === "classroom"
    ? {
        document_id: document.id,
        scope_type: "classroom" as const,
        classroom_id: document.classroomId,
        group_id: null,
      }
    : {
        document_id: document.id,
        scope_type: "group" as const,
        classroom_id: null,
        group_id: scope.groupId,
      };
  const { error } = await client.from("document_shares").insert(payload);
  if (error) throw new Error(readableDataError(error.message));
}

export async function revokeDocumentShare(shareId: string) {
  const client = requireSupabase();
  const { error } = await client.from("document_shares").delete().eq("id", shareId);
  if (error) throw new Error(readableDataError(error.message));
}

export async function downloadDocument(document: LibraryDocument) {
  const client = requireSupabase();
  const { data, error } = await client.storage.from(BUCKET).download(
    document.storagePath,
    { cacheNonce: crypto.randomUUID() },
    { cache: "no-store" },
  );
  if (error) throw new Error(readableDataError(error.message));
  return data;
}

export async function deleteDocument(documentId: string) {
  const client = requireSupabase();
  const invocation = await client.functions.invoke("document-delete", {
    body: { documentId },
    timeout: 45_000,
  });
  if (invocation.error) {
    throw new Error(await readableFunctionError(invocation.error, "No fue posible eliminar el documento."));
  }
}
