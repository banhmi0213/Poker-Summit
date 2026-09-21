// Grid coordinates for the interactive prefecture map on the portal home page.
// [name, column, row, columnSpan?, rowSpan?] — column/row are 0-indexed.
export const PREF_GRID: [string, number, number, number?, number?][] = [
  ["北海道", 9, 0, 2, 2],
  ["青森県", 9, 2],
  ["岩手県", 9, 3],
  ["秋田県", 8, 3],
  ["宮城県", 9, 4],
  ["山形県", 8, 4],
  ["福島県", 9, 5],
  ["新潟県", 8, 5],
  ["富山県", 7, 5],
  ["石川県", 6, 5],
  ["福井県", 6, 6],
  ["長野県", 8, 6],
  ["山梨県", 8, 7],
  ["岐阜県", 7, 6],
  ["静岡県", 8, 8],
  ["愛知県", 7, 7],
  ["群馬県", 9, 6],
  ["栃木県", 10, 6],
  ["茨城県", 11, 6],
  ["埼玉県", 9, 7],
  ["千葉県", 11, 7],
  ["東京都", 9, 8],
  ["神奈川県", 9, 9],
  ["三重県", 6, 7],
  ["滋賀県", 6, 8],
  ["京都府", 5, 8],
  ["大阪府", 5, 9],
  ["兵庫県", 4, 8],
  ["奈良県", 6, 9],
  ["和歌山県", 5, 10],
  ["鳥取県", 3, 7],
  ["島根県", 2, 7],
  ["岡山県", 4, 9],
  ["広島県", 3, 8],
  ["山口県", 2, 9],
  ["徳島県", 5, 11],
  ["香川県", 4, 10],
  ["愛媛県", 3, 10],
  ["高知県", 4, 11],
  ["福岡県", 2, 10],
  ["佐賀県", 1, 10],
  ["長崎県", 0, 10],
  ["熊本県", 1, 11],
  ["大分県", 2, 11],
  ["宮崎県", 2, 12],
  ["鹿児島県", 1, 12],
  ["沖縄県", 0, 13],
];

export function shortPref(p: string): string {
  return p === "北海道" ? p : p.replace(/[都道府県]$/, "");
}

export function buildStoreListHref(q: string, category: string, pref: string): string {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (category) sp.set("category", category);
  if (pref) sp.set("pref", pref);
  const qs = sp.toString();
  return qs ? `/stores?${qs}` : "/stores";
}