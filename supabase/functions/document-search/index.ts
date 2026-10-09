import { withSupabase } from "@supabase/server";

import { createEmbeddings, EmbeddingProviderError, vectorToPostgres } from "../_shared/rag/openai.ts";

const VALID_SCOPES = new Set(["all", "private", "group", "classroom"]);

function jsonError(message: string, code: string, status: number) {
  return Response.json({ message, code }, { status });
}

function databaseError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("hourly rag search limit")) return jsonError("Alcanzaste el límite de búsquedas por hora.", "SEARCH_RATE_LIMIT", 429);
  if (normalized.includes("invalid search scope") || normalized.includes("between 3 and 500")) return jsonError("La búsqueda no es válida.", "INVALID_SEARCH", 400);
  return jsonError("No fue posible recuperar fragmentos autorizados.", "RETRIEVAL_FAILED", 500);
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

    const queryValue = body && typeof body === "object" ? Reflect.get(body, "query") : null;
    const scopeValue = body && typeof body === "object" ? Reflect.get(body, "scope") : null;
    const countValue = body && typeof body === "object" ? Reflect.get(body, "matchCount") : null;
    const query = typeof queryValue === "string" ? queryValue.trim() : "";
    const scope = typeof scopeValue === "string" ? scopeValue : "all";
    const matchCount = typeof countValue === "number" && Number.isInteger(countValue) ? countValue : 5;
    if (query.length < 3 || query.length > 500 || !VALID_SCOPES.has(scope) || matchCount < 1 || matchCount > 10) {
      return jsonError("Usa una consulta de 3 a 500 caracteres, un alcance válido y hasta 10 resultados.", "INVALID_SEARCH", 400);
    }

    const userId = context.userClaims?.id;
    if (!userId) return jsonError("Se requiere una sesión válida.", "AUTH_REQUIRED", 401);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return jsonError("El proveedor de embeddings no está configurado.", "EMBEDDING_NOT_CONFIGURED", 503);
    const model = Deno.env.get("EMBEDDING_MODEL") ?? "text-embedding-3-small";
    const dimensions = Number(Deno.env.get("EMBEDDING_DIMENSIONS") ?? "1536");
    if (model !== "text-embedding-3-small" || dimensions !== 1536) {
      return jsonError("La configuración de embeddings no coincide con el índice.", "EMBEDDING_CONFIG_MISMATCH", 500);
    }

    try {
      const reservation = await context.supabaseAdmin.rpc("internal_begin_rag_search", {
        requesting_user_id: userId,
        requested_scope: scope,
        query_characters: query.length,
        requested_embedding_model: model,
      });
      if (reservation.error || typeof reservation.data !== "string") {
        return databaseError(reservation.error?.message ?? "invalid search reservation");
      }
      const embedded = await createEmbeddings({ apiKey, model, dimensions, inputs: [query] });
      const searchResult = await context.supabaseAdmin.rpc("internal_search_document_chunks", {
        requesting_user_id: userId,
        search_event_id: reservation.data,
        search_query: query,
        query_embedding: vectorToPostgres(embedded.embeddings[0]),
        requested_scope: scope,
        requested_match_count: matchCount,
        requested_embedding_model: model,
        query_embedding_tokens: embedded.tokenCount,
        embedding_latency_ms: embedded.latencyMs,
      });
      if (searchResult.error) return databaseError(searchResult.error.message);

      return Response.json({
        query,
        scope,
        model,
        results: searchResult.data ?? [],
        usage: { embeddingTokens: embedded.tokenCount, embeddingLatencyMs: embedded.latencyMs },
      });
    } catch (error) {
      if (error instanceof EmbeddingProviderError) {
        console.error(`RAG search embedding failed: code=${error.code}`);
        return jsonError(error.message, error.code.toUpperCase(), error.status);
      }
      console.error("RAG search failed before retrieval.");
      return jsonError("No fue posible preparar la búsqueda.", "SEARCH_FAILED", 500);
    }
  }),
};
