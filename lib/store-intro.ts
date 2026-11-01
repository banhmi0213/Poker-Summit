/** Store introduction for stores that have not written their own (2026/10/26; facts only since 2026/10/30).
 * Built only from registered facts (area, address, hours, nearby listings, events, SNS), so every page says
 * something specific to that store instead of the same template — Google was treating the template pages as duplicates.
 */
export type IntroNearby = { name: string; km: number | null };
export type IntroInput = {
  name: string;
  categoryLabel: string;
  pref: string | null;
  city: string | null;
  cityNickname?: string | null;
  address: string | null;
  station: string | null;
  hoursText: string | null;
  googleHoursText: string[] | null;
  nearby: IntroNearby[];
  cityStoreCount: number;
  upcomingEvents: number;
  hasX: boolean;
  hasInstagram: boolean;
  siteName: string;
};

const DAYS = ["月", "火", "水", "木", "金", "土", "日"];

/** Town name from an address: "東京都豊島区西池袋1丁目2-3" -> "西池袋". */
export function townFromAddress(address: string | null, pref: string | null, city: string | null) {
  if (!address) return "";
  let rest = address.replace(/^〒?\s*\d{3}-?\d{4}\s*/, "").trim();
  if (pref && rest.startsWith(pref)) rest = rest.slice(pref.length);
  if (city && rest.startsWith(city)) rest = rest.slice(city.length);
  const town = rest.match(/^([^\d０-９\s、,－ー−-]+?)(?=[\d０-９一二三四五六七八九十]+丁目|[\d０-９]|$)/)?.[1] ?? "";
  // Drop leftover ward names and building-like words; keep it short and plain.
  const cleaned = town.replace(/^(.+?[区市町村])(?=.)/, "").replace(/(丁目|番地)$/, "");
  return cleaned.length >= 1 && cleaned.length <= 8 && /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(cleaned) ? cleaned : "";
}

type DayHours = { day: string; closed: boolean; allDay: boolean; split?: boolean; open?: number; close?: number };
/** Parse Google opening-hours lines like "月曜日: 15時00分～23時00分" / "火曜日: 定休日" / "水曜日: 24 時間営業". */
export function parseGoogleHours(lines: string[] | null): DayHours[] {
  if (!Array.isArray(lines)) return [];
  const out: DayHours[] = [];
  for (const line of lines) {
    const day = line.match(/^(.)曜日/)?.[1];
    if (!day || !DAYS.includes(day)) continue;
    if (/定休日|休業/.test(line)) { out.push({ day, closed: true, allDay: false }); continue; }
    if (/24\s*時間営業/.test(line)) { out.push({ day, closed: false, allDay: true }); continue; }
    const ranges = [...line.matchAll(/(\d{1,2})時(\d{2})分\s*[～~]\s*(\d{1,2})時(\d{2})分/g)].map((m) => {
      const open = Number(m[1]) * 60 + Number(m[2]);
      let close = Number(m[3]) * 60 + Number(m[4]);
      if (close <= open) close += 24 * 60;
      return { open, close };
    });
    if (!ranges.length) continue;
    out.push({ day, closed: false, allDay: false, split: ranges.length > 1, open: Math.min(...ranges.map((r) => r.open)), close: Math.max(...ranges.map((r) => r.close)) });
  }
  return out;
}

const clock = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  const label = h === 24 && m === 0 ? "24時" : h >= 24 ? `翌${h - 24}時` : `${h}時`;
  return m ? `${label}${m}分` : label;
};

/** What the registered hours say, and nothing more (2026/10/30: facts only, no guesses about how the store is used).
 * Returns "" when the hours are incomplete. */
export function hoursSentence(days: DayHours[]) {
  if (days.length < 7) return "";
  const prefix = "Googleマップに登録されている営業時間では、";
  if (days.every((d) => d.allDay)) return `${prefix}毎日24時間営業です。`;
  const closed = days.filter((d) => d.closed).map((d) => d.day);
  const allDay = days.filter((d) => d.allDay).map((d) => d.day);
  const open = days.filter((d) => !d.closed && !d.allDay && d.open !== undefined);
  const parts: string[] = [];
  if (closed.length) parts.push(`${closed.join("・")}曜日が定休日`);
  if (allDay.length) parts.push(`${allDay.join("・")}曜日は24時間営業`);
  let note = "";
  if (open.length) {
    const rest = closed.length || allDay.length ? "そのほかの日は" : "毎日";
    const span = (values: number[]) => {
      const lo = Math.min(...values), hi = Math.max(...values);
      return lo === hi ? clock(lo) : `${clock(lo)}〜${clock(hi)}`;
    };
    const same = open.every((d) => d.open === open[0].open && d.close === open[0].close);
    if (same) parts.push(`${rest}${clock(open[0].open!)}から${clock(open[0].close!)}まで`);
    else parts.push(`${rest === "毎日" ? "" : rest}曜日によって営業時間が異なり、開店は${span(open.map((d) => d.open!))}、閉店は${span(open.map((d) => d.close!))}`);
    if (open.some((d) => d.split)) note = "途中に休憩時間がある日もあります。";
  }
  return parts.length ? `${prefix}${parts.join("で、")}です。${note}` : "";
}

export function hoursSentenceFromText(text: string | null) {
  if (!text) return "";
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 0 && t.length <= 60 ? `営業時間は「${t}」です。` : "";
}

/** Paragraphs (2-4 short ones) for the 「◯◯について」 section. */
export function buildStoreIntro(input: IntroInput): string[] {
  const { name, categoryLabel, pref, city } = input;
  const town = townFromAddress(input.address, pref, city);
  const place = [pref, city].filter(Boolean).join("") || "日本";
  // Only what the address says. A ward's nickname is not used: not every store in 港区 is in 六本木.
  const where = town ? `${place}の${town}` : place;
  const first = [`${name}は、${where}にある${categoryLabel}です。`];
  if (input.station) first.push(`最寄り駅は${input.station}です。`);
  const hours = input.googleHoursText?.length ? hoursSentence(parseGoogleHours(input.googleHoursText)) : hoursSentenceFromText(input.hoursText);
  if (hours) first.push(hours);

  const second: string[] = [];
  const sorted = input.nearby.filter((s) => s.km !== null).sort((a, b) => a.km! - b.km!);
  const close = sorted.filter((s) => s.km! <= 1).slice(0, 2);
  const km = (v: number) => (v < 0.1 ? "直線で100m以内" : `直線で約${v.toFixed(1)}km`);
  if (close.length >= 2) second.push(`近くには${close[0].name}（${km(close[0].km!)}）や${close[1].name}（${km(close[1].km!)}）があります。`);
  else if (close.length === 1) second.push(`近くには${close[0].name}（${km(close[0].km!)}）があります。`);
  else if (sorted[0] && sorted[0].km! <= 3) second.push(`${sorted[0].name}（${km(sorted[0].km!)}）も近くにあります。`);
  else if (sorted[0]) second.push(`${input.siteName}に掲載している店舗の中では、${sorted[0].name}（${km(sorted[0].km!)}）がいちばん近いお店です。`);
  if (city && input.cityStoreCount > 1) second.push(`${city}では、${name}を含めて${input.cityStoreCount}店舗を掲載しています。`);
  else if (city) second.push(`${city}で${input.siteName}に掲載しているのは、いまのところ${name}だけです。`);

  const third: string[] = [];
  if (input.upcomingEvents > 0) third.push(`現在、${input.upcomingEvents}件のトーナメント・イベントの開催が予定されています。`);
  const sns = [input.hasX ? "X" : "", input.hasInstagram ? "Instagram" : ""].filter(Boolean);
  if (sns.length) third.push(`店舗の${sns.join("・")}のアカウントも登録されています。`);
  third.push("料金やルール、初めての来店については、各タブの情報をご覧いただくか店舗へ直接お問い合わせください。");

  return [first.join(""), second.join(""), third.join("")].filter(Boolean);
}
