import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Privileged, RLS-bypassing client for server-only code paths that have no
// Supabase Auth session to work with — specifically the LIFF (LINE mini-app)
// API routes under app/api/liff/*. There is no `auth.uid()` for a LINE user,
// so those routes authorize manually (verified LINE ID token -> line_user_id
// -> stores row) and then use this client to read/write on the store's
// behalf. NEVER import this from a Server Component, a Server Action, or any
// route reachable from the browser session's own request — it has no
// concept of "the current user" and skips every RLS policy.
//
// Requires SUPABASE_SERVICE_ROLE_KEY to be set (Supabase dashboard ->
// Project Settings -> API -> service_role secret). Not the same as
// NEXT_PUBLIC_SUPABASE_ANON_KEY, and must never be exposed to the client
// (no NEXT_PUBLIC_ prefix, never sent in a response body or client bundle).
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY が設定されていません。Vercelの環境変数を確認してください。"
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
