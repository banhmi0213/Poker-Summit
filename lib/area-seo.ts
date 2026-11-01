import { CATEGORY_LABEL } from "@/lib/constants";
import type { AreaStats } from "@/lib/store-list-data";

// 地域ページ(都道府県・市区町村)の検索向けの文(2026/10/20)。数字はDBから(lib/store-list-data.ts getAreaStats)。
// 「ポーカーハウス」「ポーカー店」など、検索でよく使われる言い方も入れる。地方の店が少ない県でも自然な文になるようにする。

const KIND = "アミューズメントポーカー・ポーカーハウス";

// 店の多い区の繁華街の呼び名(「心斎橋 ポーカー」「六本木 ポーカー」のような検索向け、2026/10/26)。
// 掲載店の住所に実際に多い地名から選んだ。店の分布が変わったら見直す。
export const CITY_NICKNAMES: Record<string, string> = {
  "大阪市中央区": "ミナミ・心斎橋・難波",
  "大阪市北区": "キタ・梅田",
  "港区": "六本木・新橋・赤坂",
  "新宿区": "新宿・歌舞伎町",
  "渋谷区": "渋谷・恵比寿",
  "豊島区": "池袋",
  "名古屋市中区": "栄・錦",
  "福岡市中央区": "天神・今泉・大名",
  "福岡市博多区": "中洲・博多",
  "北九州市小倉北区": "小倉",
  "神戸市中央区": "三宮",
  "京都市中京区": "河原町・木屋町",
};

export function areaTitleBase(place: string, total: number) {
  return total > 0 ? `${place}の${KIND}一覧（${total}店）` : `${place}の${KIND}一覧`;
}

function cityList(stats: AreaStats, pref: string) {
  return stats.topCities.map((c) => c.city.replace(new RegExp(`^${pref}`), "")).filter(Boolean);
}

function hasMoreCities(stats: AreaStats) {
  return stats.total > stats.topCities.reduce((a, c) => a + c.n, 0);
}

export function areaDescription(place: string, pref: string, stats: AreaStats, isCity: boolean) {
  // 事実だけ（2026/10/30）：掲載がない情報（イベント・求人・クーポン）や、ない絞り込み（営業時間）は書かない
  if (stats.total === 0) {
    return `${place}のポーカー店（アミューズメントポーカー・ポーカーハウス・ポーカーバー）をPoker Summitで探せます。`;
  }
  // 載せた市で全店になるときは「など」を付けない(ほかに市があるように読めるため)
  const cities = !isCity && stats.topCities.length > 1 ? `${cityList(stats, pref).join("・")}${hasMoreCities(stats) ? "など" : ""}にあります。` : "";
  return `${place}のポーカー店（アミューズメントポーカー・ポーカーハウス・ポーカーバー）${stats.total}店を掲載。${cities}住所や営業時間など、店舗ごとの情報をまとめています。`;
}

/** ページの一番下に小さく出す紹介文 */
export function areaIntro(place: string, pref: string, stats: AreaStats, isCity: boolean) {
  if (stats.total === 0) return null;
  const label = (c: string) => CATEGORY_LABEL[c] ?? c;
  const tail = stats.total === 1 ? "住所や営業時間などの店舗情報を確認できます。" : "各店舗の住所や営業時間などの情報を確認できます。";
  // 1店だけの地域(地方の県など)は1文にまとめる
  if (stats.total === 1) {
    const where = !isCity && stats.topCities[0] ? `${stats.topCities[0].city}の` : "";
    const kind = stats.categories[0] ? label(stats.categories[0].category) : "ポーカースポット";
    return `${place}には、Poker Summitに掲載中のポーカースポットが1店（${where}${kind}）あります。${tail}`;
  }
  const parts: string[] = [`${place}には、Poker Summitに掲載中のポーカースポットが${stats.total}店あります。`];
  if (!isCity && stats.topCities.length > 1) {
    const many = stats.topCities[0].n > 1;
    parts.push(`${many ? "店舗が多いエリアは" : "店舗があるエリアは"}${stats.topCities.map((c) => {
      const nick = CITY_NICKNAMES[c.city];
      return many ? `${c.city}（${nick ? `${nick} ` : ""}${c.n}店）` : nick ? `${c.city}（${nick}）` : c.city;
    }).join("・")}${hasMoreCities(stats) ? "など" : ""}です。`);
  } else if (!isCity && stats.topCities.length === 1) {
    parts.push(`すべて${stats.topCities[0].city}にあります。`);
  }
  if (stats.categories.length > 1) {
    parts.push(`種類別では、${stats.categories.map((c) => `${label(c.category)}${c.n}店`).join("・")}です。`);
  } else if (stats.categories.length === 1) {
    parts.push(`すべて${label(stats.categories[0].category)}です。`);
  }
  parts.push(tail);
  return parts.join("");
}
