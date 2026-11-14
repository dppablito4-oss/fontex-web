import { withSupabase } from "@supabase/server";
import { createPrimitiveHandler } from "./primitive-handler.ts";
const handler = createPrimitiveHandler((name) => Deno.env.get(name));
export default {
  fetch: withSupabase(
    { auth: "user" },
    (request, context) => handler(request, { userClaims: context.userClaims }),
  ),
};
