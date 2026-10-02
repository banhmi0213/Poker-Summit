import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { importStoresFromGooglePlaces } from "./actions";
import { PREF_OPTIONS, REGIONS, primaryRegionForPref } from "@/lib/constants";

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
    keyword: string;
    found: number;
    skippedExisting: number;
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
            「{result.keyword}」× {result.pref} の検索結果
          </h3>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            検索でヒット: {result.found}件 ／ 取り込み済みのためスキップ: {result.skippedExisting}件 ／ 閉店済みのためスキップ:{" "}
            {result.skippedClosed}件 ／ 除外ワードでスキップ: {result.skippedByFilter}件 ／{" "}
            <strong>新規に承認待ちで追加: {result.inserted}件</strong>
            {result.failed > 0 && <> ／ 登録失敗: {result.failed}件</>}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 10 }}>検索して取り込む</h3>
        <form
          action={importStoresFromGooglePlaces}
          style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}
        >
          <div className="field">
            <span className="muted">都道府県 *</span>
            <select name="pref" required defaultValue="">
              <option value="" disabled>
                選択してください
              </option>
              {REGIONS.map((region) => (
                <optgroup key={region} label={region}>
                  {PREF_OPTIONS.filter((p) => primaryRegionForPref(p) === region).map(
                    (p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    )
                  )}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">検索キーワード</span>
            <input type="text" name="keyword" defaultValue="ポーカー" />
            <span className="muted" style={{ fontSize: 11.5 }}>
              未入力の場合は「ポーカー」で検索します。「雀荘」「カジノバー」など別のキーワードでも検索できます。
            </span>
          </div>
          <div className="field">
            <span className="muted">除外キーワード</span>
            <input type="text" name="excludeKeywords" placeholder="例: パチンコ, 風俗, 閉店" />
            <span className="muted" style={{ fontSize: 11.5 }}>
              店名にここで指定した単語が含まれる候補は取り込みません。カンマ・読点・スペース区切りで複数指定できます(任意)。
            </span>
          </div>
          <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
            検索して取り込む
          </button>
        </form>
      </div>

      <div className="card">
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
    </div>
  );
}
