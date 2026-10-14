import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getPlaceOpeningHours } from "@/lib/google-places";

// Googleマップから営業時間を取って、店舗ページに表示する(2026/10)。
// - 店舗(または運営)が営業時間を入れている店は取らない。入れた時点でGoogleの営業時間は消す。
// - Googleの規約で、取った情報は30日を超えて保存できない。25日たったら取り直し、
//   30日を超えたものは消す。
// - 営業時間の取得は Google の「Contact Data」(毎月1,000回まで無料)で数えられる。
//   店舗の取り込み(電話番号の取得)でも同じ枠を使うので、営業時間は月 MONTHLY_CAP 回までにする。

export const MONTHLY_CAP = 850;
const REFRESH_AFTER_DAYS = 25;
const KEEP_DAYS = 30;

function jstMonth() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
}

/** 30日を超えたGoogleの営業時間と、店舗が自分で営業時間を入れた店のGoogle営業時間を消す */
export async function clearStaleGoogleHours() {
  const svc = createServiceRoleClient();
  const limit = new Date(Date.now() - KEEP_DAYS * 86400 * 1000).toISOString();
  const clear = { google_hours_text: null, google_hours_periods: null, google_hours_fetched_at: null };
  await svc.from("stores").update(clear).lt("google_hours_fetched_at", limit);
  await svc.from("stores").update(clear).not("google_hours_fetched_at", "is", null).neq("hours", "");
}

/**
 * 営業時間が空の掲載店舗を、未取得・古い順に limit 件ずつGoogleから取る。
 * 戻り値: 今回取った件数・営業時間が見つかった件数・まだ残っている件数・月間上限に達したか
 */
export async function fetchNextGoogleHours(limit = 30) {
  const svc = createServiceRoleClient();
  await clearStaleGoogleHours();

  // 月間の使用回数(日本時間の月ごとに数え直す)
  const month = jstMonth();
  const { data: state } = await svc.from("store_maintenance_state").select("hours_month, hours_count").eq("id", 1).maybeSingle();
  let used = state?.hours_month === month ? state?.hours_count ?? 0 : 0;
  const allowed = Math.max(0, Math.min(limit, MONTHLY_CAP - used));

  const refreshBefore = new Date(Date.now() - REFRESH_AFTER_DAYS * 86400 * 1000).toISOString();
  const targets = () =>
    svc
      .from("stores")
      .select("id, google_place_id", { count: "exact" })
      .eq("status", "approved")
      .not("google_place_id", "is", null)
      // 「営業時間が空」かつ「未取得 または 古い」(or を2つ並べず、1つの or にまとめる)
      .or(
        [
          "and(hours.is.null,google_hours_fetched_at.is.null)",
          `and(hours.is.null,google_hours_fetched_at.lt.${refreshBefore})`,
          "and(hours.eq.,google_hours_fetched_at.is.null)",
          `and(hours.eq.,google_hours_fetched_at.lt.${refreshBefore})`,
        ].join(",")
      );

  if (allowed === 0) {
    const { count } = await targets().limit(1);
    return { fetched: 0, found: 0, remaining: count ?? 0, capReached: true, used };
  }

  const { data: rows } = await targets().order("google_hours_fetched_at", { ascending: true, nullsFirst: true }).limit(allowed);
  let fetched = 0;
  let found = 0;
  const queue = [...(rows ?? [])];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const r = await getPlaceOpeningHours(s.google_place_id as string);
      fetched++;
      if (!r) continue; // 通信エラー等は次回に回す(取得日時を更新しない)
      if (r.weekdayText) found++;
      await svc
        .from("stores")
        .update({
          google_hours_text: r.weekdayText,
          google_hours_periods: r.periods,
          google_hours_fetched_at: new Date().toISOString(),
        })
        .eq("id", s.id);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  used += fetched;
  await svc.from("store_maintenance_state").update({ hours_month: month, hours_count: used }).eq("id", 1);
  const { count } = await targets().limit(1);
  return { fetched, found, remaining: count ?? 0, capReached: used >= MONTHLY_CAP, used };
}
