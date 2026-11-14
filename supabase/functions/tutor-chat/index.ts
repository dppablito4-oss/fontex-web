import { withSupabase } from "@supabase/server";
import { createTutorHandler } from "./handler.ts";
import { betaDenial } from "../_shared/beta.ts";

export default {
  fetch: withSupabase(
    { auth: "user" },
    async (request, context) => {
      const denial = await betaDenial(context.userClaims?.id, (name,args) => context.supabaseAdmin.rpc(name,args), true);
      return denial ?? createTutorHandler((name) => Deno.env.get(name))(request,context);
    },
  ),
};
