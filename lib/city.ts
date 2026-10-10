// 市区町村の正規化と、市区町村ページ(/stores/area/[pref]/[city])まわりの共通処理。
//
// 店舗の city は入力のされ方がまちまち(「立川市錦町1-2-13」のように番地まで入っている、
// 空欄で住所にしか書いていない、など)なので、保存時に「〇〇市」「〇〇区」「〇〇町」の形に
// 揃える。これで新しく登録された店舗も自動的に正しい市区町村ページに振り分けられる。

/** 政令指定都市。「大阪市中央区」のように区まで持つ。市のページは配下の区をまとめて表示する。 */
export const DESIGNATED_CITIES = [
  "札幌市", "仙台市", "さいたま市", "千葉市", "横浜市", "川崎市", "相模原市", "新潟市", "静岡市", "浜松市",
  "名古屋市", "京都市", "大阪市", "堺市", "神戸市", "岡山市", "広島市", "北九州市", "福岡市", "熊本市",
];

// 「市」「町」「村」が名前の途中に入っていて、最短一致だと途中で切れてしまう自治体
const TRICKY_NAMES = [
  "四日市市", "廿日市市", "大町市", "十日町市", "野々市市", "東村山市", "武蔵村山市", "羽村市", "大村市", "田村市",
  "玉村町", "市川三郷町",
];

/** 市区町村ページを作る(検索結果に出す)最低店舗数。少なすぎるページは中身が薄くなるので出さない。 */
export const CITY_PAGE_MIN_STORES = 3;

function extractCity(text: string, pref: string | null): string | null {
  let s = text
    .replace(/〒?\s*\d{3}[-－‐]?\d{4}/g, "")
    .replace(/[\s　]+/g, "")
    .trim();
  if (pref && s.startsWith(pref)) s = s.slice(pref.length);
  if (!s) return null;

  for (const d of DESIGNATED_CITIES) {
    if (s.startsWith(d)) {
      const ward = s.slice(d.length).match(/^(.{1,5}?区)/);
      return ward ? d + ward[1] : d;
    }
  }
  for (const t of TRICKY_NAMES) {
    if (s.startsWith(t)) return t;
  }
  // 「〇〇郡〇〇町」は町村名だけにする(既存データと同じ形)
  const gun = s.match(/^.{1,6}?郡(.{1,6}?[町村])/);
  if (gun) return gun[1];
  const m = s.match(/^(.{1,8}?[市区町村])/);
  return m ? m[1] : null;
}

/**
 * 保存前の市区町村を正規化する。
 * - 「〇〇市」「大阪市中央区」の形ならそのまま。番地まで入っている等の場合は先頭の市区町村だけ取り出す
 * - 空欄なら住所から取り出す
 */
export function normalizeCity(pref: string | null | undefined, city: string | null | undefined, address: string | null | undefined): string | null {
  const p = pref?.trim() || null;
  const c = (city ?? "").replace(/[\s　]+/g, "").trim();
  return (c && extractCity(c, p)) || (address ? extractCity(address, p) : null) || c || null;
}

/** その市区町村が政令指定都市(配下の区をまとめるページ)かどうか */
export function isDesignatedCity(city: string) {
  return DESIGNATED_CITIES.includes(city);
}

/** 店舗の city から、その店舗が載る市区町村ページのキー(区 + 政令市)を返す */
export function cityPageKeys(city: string | null | undefined): string[] {
  if (!city) return [];
  const parent = DESIGNATED_CITIES.find((d) => city.startsWith(d) && city !== d);
  return parent ? [city, parent] : [city];
}

/** 市区町村ページのURL(/stores/area/東京都/新宿区) */
export function cityPageHref(pref: string, city: string) {
  return `/stores/area/${encodeURIComponent(pref)}/${encodeURIComponent(city)}`;
}

/** 都道府県内の店舗の city 一覧から、市区町村ページごとの店舗数を数える */
export function countCityPages(cities: (string | null | undefined)[]) {
  const counts = new Map<string, number>();
  for (const c of cities) for (const key of cityPageKeys(c)) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}
