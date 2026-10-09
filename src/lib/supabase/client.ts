import { createClient } from "@supabase/supabase-js";

import { supabaseConfig } from "./config";
import type { Database } from "./database.types";

export const supabase = supabaseConfig
  ? createClient<Database>(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
