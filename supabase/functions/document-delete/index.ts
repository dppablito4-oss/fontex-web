import { withSupabase } from "@supabase/server";
import { betaDenial } from "../_shared/beta.ts";
import { BodyError, jsonObject } from "../_shared/http.ts";

const BUCKET = "fontex-documents";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, code: string, status: number) {
  return Response.json({ message, code }, { status });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    const denial = await betaDenial(context.userClaims?.id, (name,args) => context.supabaseAdmin.rpc(name,args), false);
    if (denial) return denial;
    if (request.method !== "POST") {
      return jsonError("Método no permitido.", "METHOD_NOT_ALLOWED", 405);
    }

    let body: Record<string, unknown>;
    try {
      body = await jsonObject(request);
    } catch (error) {
      return jsonError(error instanceof BodyError ? error.message : "JSON inválido.", "INVALID_JSON", error instanceof BodyError ? error.status : 400);
    }

    const documentId = body.documentId;
    if (typeof documentId !== "string" || !UUID_PATTERN.test(documentId)) {
      return jsonError("El documento no es válido.", "INVALID_DOCUMENT_ID", 400);
    }

    const userId = context.userClaims?.id;
    if (!userId) return jsonError("Se requiere una sesión válida.", "AUTH_REQUIRED", 401);

    const documentResult = await context.supabase
      .from("documents")
      .select("id, owner_id, storage_path")
      .eq("id", documentId)
      .single();
    if (documentResult.error || !documentResult.data) {
      return jsonError("El documento no existe o no es accesible.", "DOCUMENT_NOT_FOUND", 404);
    }
    if (documentResult.data.owner_id !== userId) {
      return jsonError("Solo el propietario puede eliminar el documento.", "NOT_DOCUMENT_OWNER", 403);
    }

    const storageResult = await context.supabaseAdmin.storage
      .from(BUCKET)
      .remove([documentResult.data.storage_path]);
    if (storageResult.error && !storageResult.error.message.toLowerCase().includes("not found")) {
      console.error(`Document deletion failed: document_id=${documentId} storage_status=${storageResult.error.statusCode ?? "unknown"}`);
      return jsonError("Storage no pudo eliminar el PDF.", "STORAGE_DELETE_FAILED", 502);
    }

    const deleteResult = await context.supabaseAdmin
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("owner_id", userId)
      .select("id")
      .maybeSingle();
    if (deleteResult.error || !deleteResult.data) {
      await context.supabaseAdmin
        .from("documents")
        .update({ status: "failed", failure_code: "metadata_delete_failed" })
        .eq("id", documentId)
        .eq("owner_id", userId);
      return jsonError("El PDF se retiró, pero falta limpiar sus metadatos.", "METADATA_DELETE_FAILED", 500);
    }

    return Response.json({ documentId, deleted: true });
  }),
};
