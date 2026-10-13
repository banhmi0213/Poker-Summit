import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cookieを使わない(=誰が見ても同じ結果になる)公開データ専用のクライアント。
// unstable_cache の中では cookies() が使えないので、全員共通のデータ(店舗一覧・
// ランキング・バナー等)をキャッシュして返す関数はこれを使う(2026/10、表示速度対策)。
// 権限は未ログインの訪問者と同じ(anonキー + RLS)。
export function createAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
