import { withSupabase } from "@supabase/server";
import { createAccountAdminHandler } from "./handler.ts";
export default {
  fetch: withSupabase(
    { auth: "user" },
    (request, context) =>
      createAccountAdminHandler({
        prepare: (args) =>
          context.supabase.rpc("admin_prepare_account_deletion", args),
        remove: (paths) =>
          context.supabaseAdmin.storage.from("fontex-documents").remove(paths),
        finish: (userId, requestId) =>
          context.supabaseAdmin.rpc("admin_finish_account_deletion", {
            p_user_id: userId,
            p_request_id: requestId,
            p_actor: context.userClaims!.id,
          }),
      })(request),
  ),
};
