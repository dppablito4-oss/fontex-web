import { describe, expect, it } from "vitest";

import { resolveSupabaseConfig } from "./config";

describe("Supabase public configuration", () => {
  it("requires both public values", () => {
    expect(resolveSupabaseConfig({ VITE_SUPABASE_URL: "https://example.supabase.co" })).toBeNull();
  });

  it("accepts a publishable key without treating it as a secret", () => {
    expect(
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("rejects an insecure remote URL", () => {
    expect(
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: "http://example.com",
        VITE_SUPABASE_PUBLISHABLE_KEY: "public-key",
      }),
    ).toBeNull();
  });

  it("accepts a local HTTP URL for Supabase development", () => {
    expect(
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "public-key",
      }),
    ).toEqual({
      url: "http://127.0.0.1:54321",
      publishableKey: "public-key",
    });
  });

  it("rejects a new-format secret key in the browser configuration", () => {
    expect(
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_example",
      }),
    ).toBeNull();
  });
});
