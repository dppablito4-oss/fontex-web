import { withSupabase } from "@supabase/server";
import { createTutorHandler } from "./handler.ts";

export default {
  fetch: withSupabase(
    { auth: "user" },
    createTutorHandler((name) => Deno.env.get(name)),
  ),
};
