import { withSupabase } from "@supabase/server";
import { createAgentHandler } from "./handler.ts";

const handler = createAgentHandler((name) => Deno.env.get(name));
export default {
  fetch: withSupabase({ auth: "user" }, (request, context) =>
    handler(request, {
      userClaims: context.userClaims,
      takeQuota: async (userId) => {
        const { data, error } = await context.supabaseAdmin.rpc(
          "take_practice_tutor_quota",
          { p_user_id: userId },
        );
        if (error) throw new Error("Quota unavailable");
        return data === true;
      },
    })),
};
