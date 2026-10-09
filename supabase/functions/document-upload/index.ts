import { withSupabase } from "@supabase/server";

const BUCKET = "fontex-documents";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 256 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReservedDocument = {
  id: string;
  owner_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  content_sha256: string;
  storage_path: string;
  status: "pending" | "uploading" | "ready" | "failed";
  upload_expires_at: string;
};

function jsonError(message: string, code: string, status: number) {
  return Response.json({ message, code }, { status });
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hasPdfSignature(file: File) {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (new TextDecoder("ascii").decode(header) !== "%PDF-") return false;

  const trailerStart = Math.max(0, file.size - 2048);
  const trailer = new Uint8Array(await file.slice(trailerStart).arrayBuffer());
  return new TextDecoder("latin1").decode(trailer).includes("%%EOF");
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") {
      return jsonError("Método no permitido.", "METHOD_NOT_ALLOWED", 405);
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return jsonError("El PDF supera el límite de 5 MiB.", "FILE_TOO_LARGE", 413);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError("La carga debe usar multipart/form-data.", "INVALID_FORM_DATA", 400);
    }

    const documentId = formData.get("documentId");
    const file = formData.get("file");
    if (typeof documentId !== "string" || !UUID_PATTERN.test(documentId) || !(file instanceof File)) {
      return jsonError("La reserva o el archivo no son válidos.", "INVALID_UPLOAD", 400);
    }

    const userId = context.userClaims?.id;
    if (!userId) return jsonError("Se requiere una sesión válida.", "AUTH_REQUIRED", 401);

    const reservationResult = await context.supabase
      .from("documents")
      .select("id, owner_id, original_filename, mime_type, size_bytes, content_sha256, storage_path, status, upload_expires_at")
      .eq("id", documentId)
      .single();
    if (reservationResult.error || !reservationResult.data) {
      return jsonError("No existe una reserva accesible para esta carga.", "RESERVATION_NOT_FOUND", 404);
    }

    const reservation = reservationResult.data as ReservedDocument;
    if (reservation.owner_id !== userId) {
      return jsonError("Solo el propietario puede completar la carga.", "NOT_DOCUMENT_OWNER", 403);
    }
    if (reservation.status === "ready" || reservation.status === "uploading") {
      return jsonError("La reserva ya fue utilizada o está en proceso.", "RESERVATION_UNAVAILABLE", 409);
    }
    if (new Date(reservation.upload_expires_at).getTime() <= Date.now()) {
      await context.supabaseAdmin
        .from("documents")
        .update({ status: "failed", failure_code: "reservation_expired" })
        .eq("id", documentId)
        .eq("owner_id", userId);
      return jsonError("La reserva venció. Vuelve a seleccionar el PDF.", "RESERVATION_EXPIRED", 410);
    }

    const markFailed = async (failureCode: string) => {
      await context.supabaseAdmin
        .from("documents")
        .update({ status: "failed", failure_code: failureCode })
        .eq("id", documentId)
        .eq("owner_id", userId);
    };

    if (file.size < 1 || file.size > MAX_FILE_BYTES || file.size !== reservation.size_bytes) {
      await markFailed("size_mismatch");
      return jsonError("El tamaño del archivo no coincide con la reserva.", "SIZE_MISMATCH", 422);
    }
    if (file.type !== "application/pdf" || reservation.mime_type !== "application/pdf") {
      await markFailed("mime_mismatch");
      return jsonError("Solo se admiten archivos PDF.", "MIME_MISMATCH", 415);
    }
    if (file.name !== reservation.original_filename) {
      await markFailed("filename_mismatch");
      return jsonError("El nombre del archivo no coincide con la reserva.", "FILENAME_MISMATCH", 422);
    }
    if (!(await hasPdfSignature(file))) {
      await markFailed("invalid_pdf_signature");
      return jsonError("El archivo no tiene una estructura PDF básica válida.", "INVALID_PDF_SIGNATURE", 415);
    }

    const digest = bytesToHex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
    if (digest !== reservation.content_sha256) {
      await markFailed("hash_mismatch");
      return jsonError("El contenido del archivo cambió después de reservar la carga.", "HASH_MISMATCH", 422);
    }

    const claimResult = await context.supabaseAdmin
      .from("documents")
      .update({ status: "uploading", failure_code: null })
      .eq("id", documentId)
      .eq("owner_id", userId)
      .in("status", ["pending", "failed"])
      .gt("upload_expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (claimResult.error || !claimResult.data) {
      return jsonError("La reserva ya no está disponible.", "RESERVATION_UNAVAILABLE", 409);
    }

    const uploadResult = await context.supabaseAdmin.storage
      .from(BUCKET)
      .upload(reservation.storage_path, file, {
        // Private permissions can be revoked at any time; every download must
        // return to Storage so its SELECT policy is evaluated again.
        cacheControl: "0",
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadResult.error) {
      await markFailed("storage_upload_failed");
      console.error(`Document upload failed: document_id=${documentId} storage_status=${uploadResult.error.statusCode ?? "unknown"}`);
      return jsonError("Storage no pudo guardar el PDF. Puedes intentarlo de nuevo.", "STORAGE_UPLOAD_FAILED", 502);
    }

    const finalizeResult = await context.supabaseAdmin
      .from("documents")
      .update({ status: "ready", failure_code: null })
      .eq("id", documentId)
      .eq("owner_id", userId)
      .eq("status", "uploading")
      .select("id")
      .maybeSingle();
    if (finalizeResult.error || !finalizeResult.data) {
      await context.supabaseAdmin.storage.from(BUCKET).remove([reservation.storage_path]);
      await markFailed("metadata_finalize_failed");
      return jsonError("No fue posible confirmar la carga; el objeto se limpió.", "FINALIZE_FAILED", 500);
    }

    return Response.json({ documentId, status: "ready" }, { status: 201 });
  }),
};
