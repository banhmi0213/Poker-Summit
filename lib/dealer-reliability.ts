import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export type DealerReliability = { total: number; completed: number; cancellations: number; no_shows: number };
export async function dealerReliability(db: SupabaseClient, ids: string[]): Promise<Record<string, DealerReliability>> {
 const result: Record<string, DealerReliability> = {};
 const unique = [...new Set(ids)];
 for (let i=0; i<unique.length; i+=500) {
  const { data, error } = await db.rpc("get_dealer_reliability", { p_dealer_ids: unique.slice(i,i+500) });
  if (error) throw new Error("勤務実績を読み込めませんでした。");
  for (const row of data ?? []) result[row.dealer_user_id] = { total: Number(row.total), completed: Number(row.completed), cancellations: Number(row.cancellations), no_shows: Number(row.no_shows) };
 }
 return result;
}
