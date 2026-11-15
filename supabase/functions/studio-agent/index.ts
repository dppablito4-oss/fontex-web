import { withSupabase } from "@supabase/server";
import { createPrimitiveHandler } from "./primitive-handler.ts";
import { creditAccess } from "./credits.ts";
import { buildAccess } from "./builds.ts";
import { betaDenial, requestAccess } from "../_shared/beta.ts";
import { withPrimitiveContract } from "./release.ts";
export default {
  fetch: withPrimitiveContract(withSupabase({ auth: "user" }, async (request, context) => {
    const rpc = (name: string, args: Record<string, unknown>) => context.supabaseAdmin.rpc(name, args);
    const denial = await betaDenial(context.userClaims?.id, rpc, true);
    if (denial) return denial;
    const credits = creditAccess((name, args) =>
      context.supabaseAdmin.rpc(name, args)
    );
    return createPrimitiveHandler((name) => Deno.env.get(name), fetch, credits, requestAccess(rpc), buildAccess(rpc))(
      request,
      { userClaims: context.userClaims },
    );
  })),
};
