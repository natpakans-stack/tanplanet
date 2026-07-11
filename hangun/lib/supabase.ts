// ============================================================
// หารกัน (HanGun) — Supabase admin client (SERVER-ONLY)
//
// The app never talks to Supabase from the browser. All DB access
// goes through Next.js server actions using the service_role key,
// which bypasses RLS. Access is gated in app code by join_code /
// owner_token. Never import this from a Client Component.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — see .env.local.example',
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const STORAGE_BUCKET = 'hangun';
