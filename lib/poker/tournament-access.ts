import type { SupabaseClient } from "@supabase/supabase-js";
export const TOURNAMENT_ACCESS_MESSAGE = "オンライン・トーナメント大会設定は、運営から利用を許可された店舗のみ使用できます。";
/** Missing rows and lookup failures both deny access. Never trust a client-side flag. */
export async function loadTournamentAccess(client: SupabaseClient, storeIds: string[]) {
    if (!storeIds.length) return { enabledIds: new Set<string>(), error: false };
    const { data, error } = await client.from("poker_tournament_store_access").select("store_id,enabled").in("store_id", storeIds).eq("enabled", true);
    return { enabledIds: new Set<string>(error ? [] : (data ?? []).map(row => row.store_id)), error: Boolean(error) };
}
