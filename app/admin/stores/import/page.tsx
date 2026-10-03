import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { importStoresFromGooglePlaces } from "./actions";
import { ImportPrefAreaSelect } from "./pref-area-select";
import { KeywordTabs, DEFAULT_EXCLUDE_KEYWORDS } from "./keyword-tabs";

// 北海道のような候補数の多い都道府県だと、検索(キーワード数×ページング待機)+
// Place Details取得+DB insertの合計がデフォルトの実行時間上限に収まらず、
// 「Application error: a server-side exception has occurred」で落ちることが
// あった(2026/10、北海道の「取りこぼし確認」検索で発生)。このページ配下の
// Server Action(importStoresFromGooglePlaces)にも同じ上限が適用されるため、
// cronの/api/cron/apply-scheduled-contract-changesと同様に明示的に延長する。
export const maxDuration = 60;

// Google Placesから店舗候補を検索して取り込む運営向けツール(2026/10、
// 「店舗は地方どっかAPIで入れようと思ってる」との相談を受けて追加)。
// 取り込みは必ずstatus="pending"止まりで、公開は/admin/storesの通常の
// 承認フローに任せる(無関係な店・閉店済みの店が混ざりうるため)。
export default async function AdminStoresImportPage() {
  const supabase = await createClient();

  const jar = await cookies();

  const resultRaw = jar.get("import_result")?.value;
  let result: {
    pref: string;
    area: string;
    keywords: string[];
    excludeWords: string[];
    found: number;
    skippedExisting: number;
    skippedWrongPref: number;
    skippedClosed: number;
    skippedByFilter: number;
    inserted: number;
    failed: number;
  } | null = null;
  if (resultRaw) {
    try {
      result = JSON.parse(resultRaw);
    } catch {
      result = null;
    }
  }

  // 都道府県・検索キーワード(タブ・自由入力)・除外ワードは、前回の入力内容を
  // 次回も引き継ぐ(2026/10、「検索ワード、除外ワード入れたら消えるのやめて
  // ほしい」「都道府県を選び直すまでは前回の都道府県を引き継いでほしい、
  // エリア選ぶだけでサクサクいけるから」との指摘を受けて追加)。まだ1度も
  // 検索していない場合のみ、除外ワードはデフォルト値(パチンコ・風俗・閉店)を
  // 初期表示し、タブは「ポーカー」を初期選択する。
  const formStateRaw = jar.get("import_form_state")?.value;
  let formState: {
    pref: string;
    keyword: string;
    excludeKeywords: string;
    keywordTabs: string[];
  } | null = null;
  if (formStateRaw) {
    try {
      formState = JSON.parse(formStateRaw);
    } catch {
      formState = null;
    }
  }
  const defaultPref = formState?.pref ?? "";
  const defaultKeyword = formState?.keyword ?? "";
  const defaultExcludeKeywords = formState ? formState.excludeKeywords : DEFAULT_EXCLUDE_KEYWORDS;
  const selectedTabs = formState?.keywordTabs ?? ["ポーカー"];

  const { count: pendingImportedCount } = await supabase
    .from("stores")
    .select("id", { count: "exact", head: true })
    .not("google_place_id", "is", null)
    .eq("status", "pending");

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>店舗取込（Google Places）</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          都道府県とキーワードでGoogle Mapsを検索し、見つかった店舗候補を「承認待ち」として取り込みます。
          <br />
          閉店済みの店や、キーワードがたまたま一致しただけの無関係な店が混ざる可能性があるため、
          <strong>取り込んだ内容は自動公開されません</strong>。
          <Link href="/admin/stores?status=pending">店舗管理（承認待ち）</Link>
          の一覧で中身を確認してから、1件ずつ承認・却下・削除してください。
        </p>
      </div>

      {result && (
        <div className="card" style={{ borderColor: "var(--good)", marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>
            「{result.keywords.join(" / ")}」× {result.pref}
            {result.area && ` ${result.area}`} の検索結果
          </h3>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            検索でヒット: {result.found}件 ／ 取り込み済みのためスキップ: {result.skippedExisting}件 ／{" "}
            都道府県不一致のためスキップ: {result.skippedWrongPref ?? 0}件 ／ 閉店済みのためスキップ:{" "}
            {result.skippedClosed}件 ／ 除外ワードでスキップ: {result.skippedByFilter}件 ／{" "}
            <strong>新規に承認待ちで追加: {result.inserted}件</strong>
            {result.failed > 0 && <> ／ 登録失敗: {result.failed}件</>}
          </div>
          {result.excludeWords && result.excludeWords.length > 0 && (
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              除外ワード: {result.excludeWords.join(" / ")}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            現在、取り込み済み・承認待ちのままの店舗:{" "}
            <strong>{pendingImportedCount ?? 0}件</strong>
          </span>
          <Link href="/admin/stores?status=pending" className="btn">
            承認待ち一覧を見る
          </Link>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>検索して取り込む</h3>
        <form
          action={importStoresFromGooglePlaces}
          style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}
        >
          <ImportPrefAreaSelect initialPref={defaultPref} />
          <div className="field">
            <span className="muted">検索キーワード</span>
            <KeywordTabs selected={selectedTabs} />
            <input
              type="text"
              name="keyword"
              defaultValue={defaultKeyword}
              placeholder="タブ以外のキーワードで検索したい場合はここに入力(任意)"
            />
            <span className="muted" style={{ fontSize: 11.5 }}>
              上のタブは複数選択できます。選んだタブ＋ここに入力したキーワードをすべてOR検索し、結果を1つにまとめて取り込みます。何も選ばず未入力の場合は「ポーカー」で検索します。
            </span>
          </div>
          <div className="field">
            <span className="muted">除外キーワード</span>
            <input type="text" name="excludeKeywords" defaultValue={defaultExcludeKeywords} />
            <span className="muted" style={{ fontSize: 11.5 }}>
              店名にここで指定した単語が含まれる候補は取り込みません。カンマ・読点・スペース区切りで複数指定できます。
            </span>
          </div>
          <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
            検索して取り込む
          </button>
        </form>
      </div>
    </div>
  );
}
