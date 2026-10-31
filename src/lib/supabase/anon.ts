import { createClient } from "@supabase/supabase-js";

/**
 * Lightweight, cookie-free anonymous Supabase client for public metadata,
 * OpenGraph image generation, and sitemaps.
 */
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
