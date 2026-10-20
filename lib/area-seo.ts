import { CATEGORY_LABEL } from "@/lib/constants";
import type { AreaStats } from "@/lib/store-list-data";

// 地域ページ(都道府県・市区町村)の検索向けの文(2026/10/20)。数字はDBから(lib/store-list-data.ts getAreaStats)。
// 「ポーカーハウス」「ポーカー店」など、検索でよく使われる言い方も入れる。地方の店が少ない県でも自然な文になるようにする。

const KIND = "アミューズメントポーカー・ポーカーハウス";

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
  if (stats.total === 0) {
    return `${place}のアミューズメントポーカー・ポーカーハウス・ポーカーバーをPoker Summitで探せます。近くの地域の店舗や、営業時間・アクセス・トーナメント情報もチェックできます。`;
  }
  // 載せた市で全店になるときは「など」を付けない(ほかに市があるように読めるため)
  const cities = !isCity && stats.topCities.length > 1 ? `${cityList(stats, pref).join("・")}${hasMoreCities(stats) ? "など、" : "の店舗を、"}` : "";
  return `${place}のアミューズメントポーカー・ポーカーハウス・ポーカーバー${stats.total}店を掲載。${cities}エリアや営業時間から探せます。トーナメント・イベント・クーポン情報も。`;
}

/** ページの一番下に小さく出す紹介文 */
export function areaIntro(place: string, pref: string, stats: AreaStats, isCity: boolean) {
  if (stats.total === 0) return null;
  const label = (c: string) => CATEGORY_LABEL[c] ?? c;
  const tail =
    stats.total <= 3
      ? "営業時間・アクセス・最寄り駅のほか、近くの地域のポーカースポットやトーナメント・イベント情報も確認できます。"
      : "各店舗の営業時間・アクセス・最寄り駅のほか、トーナメント・イベントやクーポン情報も確認できます。";
  // 1店だけの地域(地方の県など)は1文にまとめる
  if (stats.total === 1) {
    const where = !isCity && stats.topCities[0] ? `${stats.topCities[0].city}の` : "";
    const kind = stats.categories[0] ? label(stats.categories[0].category) : "ポーカースポット";
    return `${place}には、Poker Summitに掲載中のポーカースポットが1店（${where}${kind}）あります。${tail}`;
  }
  const parts: string[] = [`${place}には、Poker Summitに掲載中のポーカースポットが${stats.total}店あります。`];
  if (!isCity && stats.topCities.length > 1) {
    const many = stats.topCities[0].n > 1;
    parts.push(`${many ? "店舗が多いエリアは" : "店舗があるエリアは"}${stats.topCities.map((c) => (many ? `${c.city}（${c.n}店）` : c.city)).join("・")}${hasMoreCities(stats) ? "など" : ""}です。`);
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
