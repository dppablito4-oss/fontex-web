import { withSupabase } from "@supabase/server";
import { sceneHandler } from "./handler.ts";
const handler = sceneHandler();
export default {
  fetch: withSupabase(
    { auth: "user" },
    (request, context) => handler(request, context.userClaims?.id),
  ),
};
