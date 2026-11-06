import { withSupabase } from "@supabase/server";

import { createPayload, generateTutorReply, type TutorRequest } from "../_shared/practice/tutor.ts";

const maxBodyBytes = 10_000;

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBody(request: Request): Promise<(TutorRequest & { action?: unknown }) | null> {
  if (!request.headers.get("content-type")?.startsWith("application/json") || !request.body) return null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    const value: unknown = JSON.parse(text + decoder.decode());
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    const userId = context.userClaims?.id;
    if (!userId) return json({ message: "Inicia sesión para usar el tutor." }, 401);
    if (request.method !== "POST") return json({ message: "Método no permitido." }, 405);

    const input = await readBody(request);
    if (!input) return json({ message: "Petición inválida." }, 400);

    const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (input.action === "health") return json({ available: Boolean(apiKey) });
    if (!apiKey) return json({ message: "El proveedor de IA aún no está configurado." }, 503);

    const body = createPayload(input);
    if (!body) return json({ message: "Falta una consulta o su fuente." }, 400);

    const { data: allowed, error } = await context.supabaseAdmin.rpc("take_practice_tutor_quota", {
      p_user_id: userId,
    });
    if (error) return json({ message: "No se pudo validar el límite de uso del tutor." }, 503);
    if (allowed !== true) return json({ message: "Alcanzaste el límite de consultas del tutor. Intenta más tarde." }, 429);

    const result = await generateTutorReply(apiKey, body);
    return result.status === 200 ? json(result.reply) : json({ message: result.message }, result.status);
  }),
};
