import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export type DealerReview = {id:string;rating:number|null;review:string;store_name:string;work_start:string;reviewed_at:string|null};
export type DealerReliability = { total: number; completed: number; cancellations: number; no_shows: number; average:number|null; rating_count:number; review_count:number; latest_review:DealerReview|null };
export async function dealerReliability(db: SupabaseClient, ids: string[]): Promise<Record<string, DealerReliability>> {
 const result: Record<string, DealerReliability> = {};
 const unique = [...new Set(ids)];
 for (let i=0; i<unique.length; i+=500) {
  const { data, error } = await db.rpc("get_dealer_reputation", { p_dealer_ids: unique.slice(i,i+500) });
  if (error) throw new Error("勤務実績を読み込めませんでした。");
  for (const row of data ?? []) result[row.dealer_user_id] = { total: Number(row.total), completed: Number(row.completed), cancellations: Number(row.cancellations), no_shows: Number(row.no_shows), average:row.average==null?null:Number(row.average),rating_count:Number(row.rating_count),review_count:Number(row.review_count),latest_review:row.latest_review??null };
 }
 return result;
}
