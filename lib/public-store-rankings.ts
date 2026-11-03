import type { SupabaseClient } from "@supabase/supabase-js";

// Optional public content must not take TOP/store search down when a staging
// function/table is missing or its request fails. Keep successful rows unchanged.
export async function getPublicStoreRankings(db: SupabaseClient, prefs?: string[] | null) {
  try {
    const { data, error } = await (prefs === undefined
      ? db.rpc("public_store_rankings")
      : db.rpc("public_store_rankings", { p_prefs: prefs }));
    if (error) {
      console.error("店舗ランキングを読み込めませんでした。", error.code ?? "");
      return { data: [] as any[], available: false };
    }
    return { data: (data ?? []) as any[], available: true };
  } catch {
    console.error("店舗ランキングを読み込めませんでした。");
    return { data: [] as any[], available: false };
  }
}

export async function getFavoriteStoreIds(db: SupabaseClient, userId: string | undefined) {
  if (!userId) return new Set<string>();
  try {
    const { data, error } = await db.from("favorite_stores").select("store_id").eq("user_id", userId);
    if (error) {
      console.error("お気に入り店舗を読み込めませんでした。", error.code ?? "");
      return new Set<string>();
    }
    return new Set<string>((data ?? []).map(row => row.store_id));
  } catch {
    console.error("お気に入り店舗を読み込めませんでした。");
    return new Set<string>();
  }
}
