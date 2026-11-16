import { createClient } from "@supabase/supabase-js";
import { createPrimitiveHandler } from "../studio-agent/primitive-handler.ts";
import { withPrimitiveContract } from "../studio-agent/release.ts";
const headers = {
  "X-Fontex-Classroom-Contract": "classroom-learning-v092",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-classroom-guest",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  const token = req.headers.get("x-classroom-guest") ?? "";
  const deny = () =>
    Response.json({
      message: "El acceso temporal venció. Vuelve al aula o vincula tu cuenta.",
    }, { status: 401, headers });
  if (!/^[a-f\d]{64}$/.test(token)) return deny();
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const r = await client.rpc(name, args);
    if (r.error) throw Error("No se pudo verificar la participación temporal.");
    return r.data;
  };
  try {
    const guest = await rpc("get_guest_ai_status", { p_token: token });
    if (!guest?.id) return deny();
    const build = (
      id: string,
      operation: string,
      extra: Record<string, unknown> = {},
    ) =>
      rpc("guest_ai_build", {
        p_token: token,
        p_request: id,
        p_operation: operation,
        ...extra,
      });
    const handler = createPrimitiveHandler(
      (name) => Deno.env.get(name),
      fetch,
      {
        reserve: (_user, id) => build(id, "begin"),
        finish: (id, success) => build(id, success ? "complete" : "fail"),
      },
      {
        reserve: (_user, id, task, tokens) =>
          rpc("guest_ai_usage", {
            p_token: token,
            p_request: id,
            p_task: task,
            p_tokens: tokens,
          }),
        finish: async (id) => {
          await rpc("guest_ai_usage", {
            p_token: token,
            p_request: id,
            p_finish: true,
          });
        },
      },
      {
        begin: (_user, id, scene, question) =>
          build(id, "begin", { p_scene: scene, p_question: question }),
        complete: (id, reply) => build(id, "complete", { p_reply: reply }),
        fail: async (id) => {
          await build(id, "fail");
        },
      },
    );
    const response = await withPrimitiveContract((request) =>
      handler(request, { userClaims: { id: guest.id } })
    )(req);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    return response;
  } catch {
    return deny();
  }
});
