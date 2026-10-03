// Google Places検索キーワードのプリセット「タブ」(2026/10、「検索ワードも
// 少ないやろ？？」「タブを複数選択可にして、選んだ分まとめてOR検索→結果を
// 合算」との要望を受けて追加)。チェックボックスを見た目だけチップ風に
// スタイリングしたもので、JSを使わず素のHTMLフォームとしてそのまま複数値
// (keywordTabs)が送信される。選んだタブ＋自由入力の検索キーワードは
// actions.ts側でまとめてOR検索(キーワードごとに個別検索して結果を合算)
// される。
//
// DEFAULT_EXCLUDE_KEYWORDSはパチンコ店・風俗店・閉店済み店を初回から弾く
// ための既定の除外ワード(2026/10、「除外ワードは決め打ちで入れといた方が
// いい」との要望)。actions.tsは"use server"ファイルで関数以外をexport
// できないため、この定数はここに置く。
export const KEYWORD_TAB_OPTIONS = [
  "アミューズメントポーカー",
  "ポーカー",
  "ポーカーハウス",
  "ポーカーバー",
  "ポーカークラブ",
  "ポーカールーム",
  "アミューズメントカジノ",
];

export const DEFAULT_EXCLUDE_KEYWORDS = "パチンコ, 風俗, 閉店";

export function KeywordTabs({ selected }: { selected: string[] }) {
  return (
    <div className="chip-group">
      {KEYWORD_TAB_OPTIONS.map((kw) => (
        <label className="chip" key={kw}>
          <input type="checkbox" name="keywordTabs" value={kw} defaultChecked={selected.includes(kw)} />
          {kw}
        </label>
      ))}
    </div>
  );
}
