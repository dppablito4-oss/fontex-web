import { withSupabase } from "@supabase/server";
import { createAgentHandler } from "./handler.ts";

const handler = createAgentHandler((name) => Deno.env.get(name));
export default {
  fetch: withSupabase({ auth: "user" }, (request, context) =>
    handler(request, {
      userClaims: context.userClaims,
    })),
};
