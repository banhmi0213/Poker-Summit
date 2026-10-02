"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { searchPlaces, getPlacePhone } from "@/lib/google-places";
import { primaryRegionForPref } from "@/lib/constants";

// Google Placesから見つけた候補は、いきなり公開(approved)にはせず常に
// status="pending"で仮登録する。店名にキーワードが偶然入っているだけの
// 無関係な店・閉店済みの店が混ざりうるので、/admin/stores の通常の
// 承認フローで運営が目視確認してから「承認」ボタンを押す運用にする
// (2026/10、「全部自動登録でいいんちゃん」との相談に対し、承認待ちで
// 一旦ためる半自動案を採用)。
export async function importStoresFromGooglePlaces(formData: FormData) {
  const supabase = await createClient();

  const pref = String(formData.get("pref") ?? "").trim();
  const keyword = String(formData.get("keyword") ?? "").trim() || "ポーカー";
  const excludeWordsRaw = String(formData.get("excludeKeywords") ?? "").trim();

  if (!pref) {
    throw new Error("都道府県を選んでください。");
  }

  // 除外ワードはカンマ/読点/スペース区切りで複数指定できる。店名に含まれて
  // いたら取り込み対象から外す(大文字小文字は区別しない)。無関係な店が
  // 混ざりやすいキーワードほど、運営側で「パチンコ」「風俗」等を指定して
  // 弾けるようにするため(2026/10、「不要なものを弾くフィルタリング」要望)。
  const excludeWords = excludeWordsRaw
    ? excludeWordsRaw
        .split(/[,、\s]+/)
        .map((w) => w.trim())
        .filter(Boolean)
    : [];

  function matchesExcludeWord(name: string): boolean {
    if (excludeWords.length === 0) return false;
    const lower = name.toLowerCase();
    return excludeWords.some((w) => lower.includes(w.toLowerCase()));
  }

  const results = await searchPlaces(`${keyword} ${pref}`);

  // 既に取り込み済み(google_place_id一致)のものは除外し、同じ都道府県・
  // キーワードで再検索しても重複登録しないようにする。
  const placeIds = results.map((r) => r.placeId);
  const { data: existingRows } = await supabase
    .from("stores")
    .select("google_place_id")
    .in("google_place_id", placeIds.length > 0 ? placeIds : ["-"]);
  const existingIds = new Set((existingRows ?? []).map((e) => e.google_place_id));

  const afterDedup = results.filter((r) => !existingIds.has(r.placeId));
  const afterClosed = afterDedup.filter((r) => r.businessStatus !== "CLOSED_PERMANENTLY");
  const candidates = afterClosed.filter((r) => !matchesExcludeWord(r.name));

  const skippedExisting = results.length - afterDedup.length;
  const skippedClosed = afterDedup.length - afterClosed.length;
  const skippedByFilter = afterClosed.length - candidates.length;

  let inserted = 0;
  const failures: string[] = [];

  for (const c of candidates) {
    // 電話番号はPlace Detailsを1件ずつ叩いて補完(ベストエフォート、
    // 失敗してもnullのまま取り込みは続行)。
    const tel = await getPlacePhone(c.placeId);

    const { error } = await supabase.from("stores").insert({
      name: c.name,
      status: "pending",
      pref,
      region: primaryRegionForPref(pref),
      address: c.address,
      tel,
      lat: c.lat,
      lng: c.lng,
      google_place_id: c.placeId,
    });

    if (error) {
      failures.push(`${c.name}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  await logAdminAction(supabase, "store_import_google_places", "store", undefined, {
    pref,
    keyword,
    excludeWords,
    found: results.length,
    skippedExisting,
    skippedClosed,
    skippedByFilter,
    inserted,
    failures,
  });

  revalidatePath("/admin/stores");
  revalidatePath("/admin/stores/import");

  // admin/stores/page.tsx の issued_credentials と同じパターン: サーバー
  // アクションからフォーム一発では結果を直接表示できないので、短命の
  // Cookieに結果を載せてリダイレクトし、遷移先のページで読んで表示する。
  const jar = await cookies();
  jar.set(
    "import_result",
    JSON.stringify({
      pref,
      keyword,
      found: results.length,
      skippedExisting,
      skippedClosed,
      skippedByFilter,
      inserted,
      failed: failures.length,
    }),
    { httpOnly: true, maxAge: 60, path: "/admin/stores/import" }
  );

  redirect("/admin/stores/import");
}
