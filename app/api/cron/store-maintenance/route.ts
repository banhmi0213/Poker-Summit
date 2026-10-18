import { revalidatePublicData } from "@/lib/revalidate";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sweepArea } from "@/lib/store-sweep";
import { SWEEP_AREAS } from "@/lib/sweep-areas";
import { getPlaceBusinessStatus } from "@/lib/google-places";
import { regeocodeNextStores } from "@/lib/regeocode";
import { matchNextStores, rematchUnlinkedStores } from "@/lib/google-match";
import { fetchNextGoogleHours } from "@/lib/google-hours";
import { sendStoreMaintenanceDigest } from "@/lib/email";

// ============================================================================
// 店舗データの自動見直し(毎日 Vercel Cron から呼ばれる、2026/10)。
// 1日に少しずつ進めて、約1か月で全国を1周する。
//  1. 新店さがし: 全国の地域リストを順番に AREAS_PER_RUN 地域ずつGoogleで「ポーカー」検索し、
//     店名がポーカー店らしい未登録の店を「承認待ち」に入れる(公開は運営が承認してから)。
//  2. 閉業チェック: 掲載中でGoogleと結びついた店を、確認日の古い順に CHECKS_PER_RUN 件ずつ
//     Googleの営業状況で確認し、閉業・休業になっていたら記録する(自動で消しはしない)。
//  3. 新しく入った店の座標を国土地理院で取る。
//  4. Googleマップに無かった店を、30日に1回ずつGoogleで探し直す。
//  5. 営業時間が空の店舗の営業時間をGoogleから取る(店舗が入れた店は取らない)。
// 何か見つかったら運営(site_settings.notify_email)にメールで知らせる。
// ============================================================================

export const maxDuration = 300;
export const dynamic = "force-dynamic"; // 毎回データベースの最新を読む(キャッシュしない)

const AREAS_PER_RUN = 16; // 全国約460地域 → 約1か月で1周
const CHECKS_PER_RUN = 30; // 掲載約800店 → 約1か月で1周

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.GOOGLE_PLACES_API_KEY) return NextResponse.json({ skipped: "no GOOGLE_PLACES_API_KEY" });

  const svc = createServiceRoleClient();
  const { data: state } = await svc.from("store_maintenance_state").select("*").eq("id", 1).maybeSingle();
  const tasks = Object.entries(SWEEP_AREAS).flatMap(([pref, areas]) => areas.map((area) => ({ pref, area })));
  let cursor = (state?.sweep_cursor ?? 0) % tasks.length;
  let cycle = state?.sweep_cycle ?? 0;

  // 1. 新店さがし
  const newCandidates: string[] = [];
  for (let i = 0; i < AREAS_PER_RUN; i++) {
    const t = tasks[cursor];
    try {
      const r = await sweepArea(svc, t.pref, t.area, { keywords: ["ポーカー"], onlyPokerNames: true });
      newCandidates.push(...r.inserted.map((n) => `${n}(${t.pref})`));
    } catch {
      // 1地域の失敗で全体を止めない
    }
    cursor++;
    if (cursor >= tasks.length) {
      cursor = 0;
      cycle++;
    }
  }

  // 2. 閉業チェック
  const { data: stores } = await svc
    .from("stores")
    .select("id, name, google_place_id, google_business_status")
    .eq("status", "approved")
    .not("google_place_id", "is", null)
    .order("google_checked_at", { ascending: true, nullsFirst: true })
    .limit(CHECKS_PER_RUN);
  const closed: { name: string; status: string }[] = [];
  for (const s of stores ?? []) {
    const status = await getPlaceBusinessStatus(s.google_place_id as string);
    const update: Record<string, unknown> = { google_checked_at: new Date().toISOString() };
    if (status) update.google_business_status = status;
    if (status && status !== "OPERATIONAL" && status !== s.google_business_status) {
      closed.push({ name: s.name, status });
      // 一時休業も運営の方針で掲載から外すので、閉業と同じく「要確認」に入れる
      update.google_match_status = "needs_review";
    }
    await svc.from("stores").update(update).eq("id", s.id);
  }

  // 3. 新しく入った店の座標と、Googleマップとの結びつけ
  await regeocodeNextStores(40).catch(() => null);
  await matchNextStores(16).catch(() => null);
  // 4. Googleマップに無かった店を月1回ずつ探し直す(あとから登録される店があるため)
  const rematch = await rematchUnlinkedStores(3).catch(() => ({ checked: 0, linked: [] as string[] }));
  // 5. 営業時間が空の店舗の営業時間をGoogleから取る(25日ごとに取り直し、30日を超えたものは消す。月850回まで)
  // 全店ほぼ同じ日に取ったので、取り直し(25日目)から期限(30日)までの5日で回り切るよう1日150件まで
  const hours = await fetchNextGoogleHours(150).catch(() => null);

  const result = { cursor, cycle, newCandidates: newCandidates.length, closed: closed.length, at: new Date().toISOString() };
  await svc.from("store_maintenance_state").update({ sweep_cursor: cursor, sweep_cycle: cycle, last_run_at: new Date().toISOString(), last_result: result }).eq("id", 1);
  await svc.from("audit_log").insert({ action: "store_maintenance", target_type: "store", detail: { ...result, newNames: newCandidates, closedNames: closed, rematchLinked: rematch.linked, hours } });

  if (newCandidates.length || closed.length) {
    const { data: settings } = await svc.from("site_settings").select("notify_email").eq("id", true).maybeSingle();
    if (settings?.notify_email) {
      await sendStoreMaintenanceDigest({ to: settings.notify_email, newCandidates, closed }).catch(() => null);
    }
  }
  revalidatePublicData(); // 掲載状態の変化をTOP・一覧へすぐ反映
  return NextResponse.json(result);
}
