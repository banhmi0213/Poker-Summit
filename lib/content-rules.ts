// 店舗が投稿する文章のルール(2026/10)。
// 「換金」を思わせる記載は、アミューズメントポーカーとして掲載できない(賭博と見なされるおそれがあるため)。
// 保存の時点で止める。違反は掲載停止の対象であることは、店舗管理画面の案内(StoreContentRuleNotice)に書いている。
// 「〇〇円保証」「賞金」などの大会の一般的な書き方は止めない(運営の方針)。

const BANNED = /換金|現金化/;

/** 店舗の投稿内容に禁止の言葉があれば、保存せずにエラーにする */
export function assertAllowedStoreText(...texts: Array<string | null | undefined>) {
  const joined = texts.filter(Boolean).join("\n").normalize("NFKC");
  if (BANNED.test(joined)) {
    throw new Error(
      "「換金」「現金化」を含む内容は掲載できません。アミューズメントポーカーとして、換金や賭博を思わせる記載は禁止しています(違反した場合は掲載停止の対象になります)。"
    );
  }
}
