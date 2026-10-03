"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { searchPlaces, getPlaceDetails, guessCategory, type PlaceCandidate } from "@/lib/google-places";
import { primaryRegionForPref } from "@/lib/constants";

// 配列の各要素に対して非同期処理を「同時実行数を絞って」並列実行する
// 小さなヘルパー(2026/10、Google Places検索・詳細取得の直列実行による
// タイムアウト対策として追加)。外部APIを候補数だけ順番に叩くと件数に
// 比例して遅くなるため、limit件ずつ同時に進めて短縮する。
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Google Placesから見つけた候補は、いきなり公開(approved)にはせず常に
// status="pending"で仮登録する。店名にキーワードが偶然入っているだけの
// 無関係な店・閉店済みの店が混ざりうるので、/admin/stores の通常の
// 承認フローで運営が目視確認してから「承認」ボタンを押す運用にする
// (2026/10、「全部自動登録でいいんちゃん」との相談に対し、承認待ちで
// 一旦ためる半自動案を採用)。
//
// 検索キーワードはプリセットの「タブ」(複数選択可、keyword-tabs.tsx)と
// 自由入力(keyword)を併用でき、選んだ分すべてをOR検索(キーワードごとに
// 個別に検索して結果を合算)する(2026/10、「タブを複数選択可にして、
// 選んだ分まとめてOR検索→結果を合算」との要望)。同じ店が複数キーワードで
// ヒットした場合はgoogle_place_idで1件にまとめる(既に取り込み済みの店舗は
// もちろん、再検索で別キーワード経由でも二重に取り込まない)。
export async function importStoresFromGooglePlaces(formData: FormData) {
  const supabase = await createClient();

  const pref = String(formData.get("pref") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const freeKeyword = String(formData.get("keyword") ?? "").trim();
  const tabKeywords = formData
    .getAll("keywordTabs")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const excludeWordsRaw = String(formData.get("excludeKeywords") ?? "").trim();

  if (!pref) {
    throw new Error("都道府県を選んでください。");
  }

  // タブ・自由入力のどちらも未指定なら、従来どおり「ポーカー」で検索する。
  const keywordSet = Array.from(new Set([...tabKeywords, ...(freeKeyword ? [freeKeyword] : [])]));
  const keywords = keywordSet.length > 0 ? keywordSet : ["ポーカー"];

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

  // エリア(駅名・繁華街名など)が指定されていれば都道府県名に加えて検索
  // クエリへ組み込み、より狭い範囲でヒットしやすくする(2026/10、「新宿と
  // 梅田、各都道府県の下に」との要望)。取り込む店舗データ側のpref/regionは
  // 引き続き都道府県セレクトの値をそのまま使う(エリアは検索クエリの絞り
  // 込みにのみ使い、店舗データとしては保存しない)。
  //
  // キーワードごとに個別検索するが、複数タブ選択で検索回数が増える分
  // レスポンスが遅くなりサーバーレスのタイムアウトに近づきやすいため、
  // 直列ではなく並列で叩く(2026/10、「検索中にサーバーエラーが出た」事案を
  // 踏まえた対策)。同じ場所が複数キーワードでヒットした場合はgoogle_place_id
  // でまとめて1件扱いにする。
  const searchResultsPerKeyword = await Promise.all(
    keywords.map((kw) => searchPlaces(area ? `${kw} ${area} ${pref}` : `${kw} ${pref}`))
  );
  const merged = new Map<string, PlaceCandidate>();
  for (const found of searchResultsPerKeyword) {
    for (const r of found) {
      if (!merged.has(r.placeId)) merged.set(r.placeId, r);
    }
  }
  const results = Array.from(merged.values());

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

  // Place Detailsの取得(電話番号・市区町村の補完)も候補数だけ外部APIを
  // 叩くため、直列だと候補が多いほど線形に遅くなりタイムアウトしやすい。
  // 同時実行数を絞った並列実行でまとめて取得しておき、DB insert自体は
  // その後に直列で行う(2026/10、同上の対策)。
  const detailsList = await mapWithConcurrency(candidates, 5, (c) => getPlaceDetails(c.placeId));

  let inserted = 0;
  const failures: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const details = detailsList[i];
    const category = guessCategory(c.name, c.types);

    const { error } = await supabase.from("stores").insert({
      name: c.name,
      status: "pending",
      category,
      pref,
      region: primaryRegionForPref(pref),
      city: details.city,
      address: c.address,
      tel: details.tel,
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
    area,
    keywords,
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

  const jar = await cookies();

  // admin/stores/page.tsx の issued_credentials と同じパターン: サーバー
  // アクションからフォーム一発では結果を直接表示できないので、短命の
  // Cookieに結果を載せてリダイレクトし、遷移先のページで読んで表示する。
  jar.set(
    "import_result",
    JSON.stringify({
      pref,
      area,
      keywords,
      excludeWords,
      found: results.length,
      skippedExisting,
      skippedClosed,
      skippedByFilter,
      inserted,
      failed: failures.length,
    }),
    { httpOnly: true, maxAge: 60, path: "/admin/stores/import" }
  );

  // 検索キーワード(タブ・自由入力)・除外ワード・都道府県の入力値は、次回
  // アクセス時も保持する(2026/10、「検索ワード、除外ワード入れたら消える
  // のやめてほしい」「都道府県を選び直すまでは前回の都道府県を引き継いで
  // ほしい、エリア選ぶだけでサクサクいけるから」との指摘を受けて追加)。
  // import_resultと違い、こちらは長期間保持する。
  jar.set(
    "import_form_state",
    JSON.stringify({
      pref,
      keyword: freeKeyword,
      excludeKeywords: excludeWordsRaw,
      keywordTabs: tabKeywords,
    }),
    { httpOnly: true, maxAge: 60 * 60 * 24 * 90, path: "/admin/stores/import" }
  );

  redirect("/admin/stores/import");
}
