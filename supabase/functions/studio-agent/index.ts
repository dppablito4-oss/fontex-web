import { withSupabase } from "@supabase/server";
import { createPrimitiveHandler } from "./primitive-handler.ts";
import { creditAccess } from "./credits.ts";
export default {
  fetch: withSupabase({ auth: "user" }, (request, context) => {
    const credits = creditAccess((name, args) =>
      context.supabaseAdmin.rpc(name, args)
    );
    return createPrimitiveHandler((name) => Deno.env.get(name), fetch, credits)(
      request,
      { userClaims: context.userClaims },
    );
  }),
};
