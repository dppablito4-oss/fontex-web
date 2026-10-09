export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

type PublicEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export function resolveSupabaseConfig(
  environment: PublicEnvironment,
): SupabasePublicConfig | null {
  const url = environment.VITE_SUPABASE_URL?.trim();
  const publishableKey = (
    environment.VITE_SUPABASE_PUBLISHABLE_KEY ?? environment.VITE_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !publishableKey) return null;

  if (publishableKey.startsWith("sb_secret_")) return null;

  try {
    const parsedUrl = new URL(url);
    const isSecureRemote = parsedUrl.protocol === "https:";
    const isLocalDevelopment =
      parsedUrl.protocol === "http:" &&
      (parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost");
    if (!isSecureRemote && !isLocalDevelopment) {
      return null;
    }
  } catch {
    return null;
  }

  return { url, publishableKey };
}

export const supabaseConfig = resolveSupabaseConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
