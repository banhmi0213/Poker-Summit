// 契約期間の日付計算(2026/10/18)。すべて「日本時間の暦日」で計算する。
//
// - 契約期間の終わり(store_contracts.current_period_end)は「次の期間が始まる日の 0:00(日本時間)」で持つ。
// - 毎月の更新日は billing_anchor_day(1〜31)。その月に無い日(2/30 など)は月末にする。
//   例: 31日始まりの契約 → 1/31 → 2/28 → 3/31 → 4/30 → 5/31(月末で止まらず、元の日に戻る)
// - 以前は世界標準時で「今から1か月後」を計算していたため、3/1 の更新が 3/29 になる等のずれがあった。

const JST_MS = 9 * 60 * 60 * 1000;

/** 日本時間での今日 'YYYY-MM-DD' */
export function jstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_MS).toISOString().slice(0, 10);
}

/** ISO日時 → 日本時間の暦日 'YYYY-MM-DD' */
export function jstDateOf(iso: string | Date): string {
  const ms = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  return new Date(ms + JST_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD'(日本時間)の 0:00 を ISO で */
export function jstMidnightIso(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00+09:00`)).toISOString();
}

export function addDaysToDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * 'YYYY-MM-DD' から n か月後の更新日。anchorDay(毎月の更新日)が指定されていればその日に合わせ、
 * その月に無ければ月末にする。省略時は date の日を使う。
 */
export function addMonthsAnchored(date: string, months: number, anchorDay?: number | null): string {
  const [y, m, d] = date.split("-").map(Number);
  const anchor = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : d;
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const day = Math.min(anchor, lastDayOfMonth(target.getUTCFullYear(), target.getUTCMonth()));
  target.setUTCDate(day);
  return target.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' の日(1〜31) */
export function dayOf(date: string): number {
  return Number(date.slice(8, 10));
}

/** 「2026年11月22日」 */
export function jpDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/**
 * カード契約の更新後の期間の終わり(次の更新日の 0:00 日本時間)。
 * - 期限どおりに更新できた(期限から graceDays 日以内): 前の期間の終わりから1か月(更新日を変えない)
 * - 期限から graceDays 日を過ぎてから決済できた(掲載停止後など): 決済した日から1か月(新しい更新日)
 */
export function renewedPeriodEnd(params: {
  previousPeriodEndIso: string | null;
  anchorDay: number | null;
  graceDays: number;
  now?: Date;
}): { periodEndIso: string; anchorDay: number } {
  const now = params.now ?? new Date();
  const today = jstToday(now);
  if (params.previousPeriodEndIso) {
    const prevStart = jstDateOf(params.previousPeriodEndIso); // 前の期間の終わり = 新しい期間の始まり
    const anchor = params.anchorDay ?? dayOf(prevStart);
    const lateDays = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${prevStart}T00:00:00Z`)) / 86_400_000;
    if (lateDays <= params.graceDays) {
      return { periodEndIso: jstMidnightIso(addMonthsAnchored(prevStart, 1, anchor)), anchorDay: anchor };
    }
  }
  const anchor = dayOf(today);
  return { periodEndIso: jstMidnightIso(addMonthsAnchored(today, 1, anchor)), anchorDay: anchor };
}

/** 今日(日本時間)から1か月の期間の終わり。即時の変更・新規契約用 */
export function freshPeriodEnd(now: Date = new Date()): { periodEndIso: string; anchorDay: number } {
  const today = jstToday(now);
  const anchor = dayOf(today);
  return { periodEndIso: jstMidnightIso(addMonthsAnchored(today, 1, anchor)), anchorDay: anchor };
}
