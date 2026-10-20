import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getPlaceReviewDetails } from "@/lib/google-places";
import { nameSimilarity, sameAddress } from "@/lib/google-match";
import { POKER_NAME_RE } from "@/lib/store-sweep";
import { normalizeCity } from "@/lib/city";
import { MONTHLY_CAP } from "@/lib/google-hours";

// ============================================================================
// 毎日の自動見直しで見つけた店(google_match_status = "auto_found")を調べて、
// 問題がなければ自動で掲載(status = "approved")する(2026/10/20 オーナー指示)。
//
// 掲載の前に必ずGoogleマップと照合する:
//  - Googleマップで今の情報(店名・住所・電話番号・営業時間・営業状況)を取り直す
//  - 営業中(OPERATIONAL)であること
//  - 住所がその都道府県にあること
//  - 電話番号と営業時間がGoogleマップに載っていること(実際に営業している店の目安。
//    団体・オンラインのサークル等はここで止まる)
//  - 店名がポーカー店らしく、団体・オンライン等の名前ではないこと
//  - すでに登録のある店(同じ都道府県)と店名や住所が重なっていないこと(重複登録の防止)
// 全部通れば住所・電話番号・営業時間を入れて掲載する。どれかに引っかかれば承認待ちのまま残し、
// 理由を google_match_note に書く(google_match_status = "auto_held")。運営が見て承認/却下する。
// 営業時間はGoogleの規約(保存は30日まで)に合わせて google_hours_* に入れる
// (lib/google-hours.ts が25日ごとに取り直し、30日を超えたら消す)。
// ============================================================================

const HOLD_NAME_RE = /(協会|連盟|協議会|機構|財団|association|federation|league|リーグ|オンライン|online|サークル|circle|大学|university)/i;
const LIVE_STATUSES = ["approved", "listed", "pending", "payment_suspended"];

function jstMonth() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
}

type Row = { id: string; name: string; pref: string | null; address: string | null; category: string | null; google_place_id: string | null };

export async function autoReviewNewStores(limit = 30) {
  const svc = createServiceRoleClient();
  const approved: string[] = [];
  const held: { name: string; reason: string }[] = [];

  // 電話番号・営業時間は営業時間の取得と同じ「Contact Data」の枠(月1,000回まで無料)を使うので、一緒に数える
  const month = jstMonth();
  const { data: state } = await svc.from("store_maintenance_state").select("hours_month, hours_count").eq("id", 1).maybeSingle();
  let used = state?.hours_month === month ? state?.hours_count ?? 0 : 0;
  const allowed = Math.max(0, Math.min(limit, MONTHLY_CAP - used));
  if (allowed === 0) return { approved, held, capReached: true };

  const { data: rows } = await svc
    .from("stores")
    .select("id, name, pref, address, category, google_place_id")
    .eq("status", "pending")
    .eq("google_match_status", "auto_found")
    .order("created_at")
    .limit(allowed);

  for (const s of (rows ?? []) as Row[]) {
    if (!s.google_place_id) continue;
    const d = await getPlaceReviewDetails(s.google_place_id);
    used++;
    if (!d) continue; // 通信エラー等は次回やり直し

    const pref = s.pref ?? "";
    const name = d.name ?? s.name;
    const address = d.address ?? s.address;
    const reasons: string[] = [];
    if (d.notFound) reasons.push("Googleマップから消えている");
    else if (d.businessStatus !== "OPERATIONAL") reasons.push(`Googleマップで営業中になっていない(${d.businessStatus ?? "不明"})`);
    if (!address || !address.normalize("NFKC").includes(pref)) reasons.push(`住所が${pref || "都道府県"}にない`);
    if (!d.tel) reasons.push("Googleマップに電話番号がない");
    if (!d.hoursText) reasons.push("Googleマップに営業時間がない");
    if (!POKER_NAME_RE.test(name)) reasons.push("店名がポーカー店らしくない");
    if (HOLD_NAME_RE.test(name)) reasons.push("団体・オンライン等の名前で、店舗ではない可能性");

    if (!d.notFound) {
      // 重複登録の確認(同じ都道府県で、店名がよく似ている・住所が同じ店がすでにある)
      const { data: others } = await svc
        .from("stores")
        .select("id, name, address")
        .eq("pref", pref)
        .in("status", LIVE_STATUSES)
        .neq("id", s.id);
      const dup = (others ?? []).find((o: { name: string; address: string | null }) => nameSimilarity(o.name, name) >= 0.7 || sameAddress(o.address, address));
      if (dup) reasons.push(`登録済みの「${dup.name}」と重複の可能性`);
    }

    const now = new Date().toISOString();
    const jst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
    const base = {
      google_business_status: d.businessStatus,
      google_checked_at: now,
      ...(d.tel ? { tel: d.tel } : {}),
      ...(address ? { address } : {}),
      ...(pref ? { city: normalizeCity(pref, d.city, address) } : {}),
      ...(d.hoursText ? { google_hours_text: d.hoursText, google_hours_periods: d.hoursPeriods, google_hours_fetched_at: now } : {}),
    };

    if (reasons.length) {
      await svc
        .from("stores")
        .update({ ...base, google_match_status: "auto_held", google_match_note: `自動審査で保留(${jst}): ${reasons.join(" / ")}` })
        .eq("id", s.id)
        .eq("status", "pending");
      held.push({ name: s.name, reason: reasons.join(" / ") });
    } else {
      await svc
        .from("stores")
        .update({
          ...base,
          status: "approved",
          // カテゴリを推測できなかった店は、いちばん多いアミューズメントポーカーにする(違えば運営が直す)
          ...(s.category === "other" || !s.category ? { category: "amusement" } : {}),
          google_match_status: "matched",
          google_match_note: `自動審査で掲載(${jst}): Googleマップで営業中・住所・電話番号・営業時間を確認、重複なし`,
        })
        .eq("id", s.id)
        .eq("status", "pending");
      approved.push(`${s.name}(${pref})`);
    }
  }

  await svc.from("store_maintenance_state").update({ hours_month: month, hours_count: used }).eq("id", 1);
  return { approved, held, capReached: used >= MONTHLY_CAP };
}
