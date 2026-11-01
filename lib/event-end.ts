// 大会・イベントが終わったかどうか(2026/10/18、ユーザー指示「終わった大会は表示されないように」)。
// - 終了日時(end_at)があれば、それを過ぎたら終了
// - 終了日時が無いものは、開始から6時間で終了とみなす(開始した途端に一覧から消えないように)
// - 日付の無いものは終了扱いにしない

export const NO_END_GRACE_MS = 6 * 60 * 60 * 1000;

type EventTimes = { start_at?: string | null; end_at?: string | null };

export function eventEndMs(e: EventTimes): number | null {
  if (e.end_at) return Date.parse(e.end_at);
  if (e.start_at) return Date.parse(e.start_at) + NO_END_GRACE_MS;
  return null;
}

export function isEventEnded(e: EventTimes, now: Date | string | number = Date.now()): boolean {
  const end = eventEndMs(e);
  const nowMs = typeof now === "number" ? now : typeof now === "string" ? Date.parse(now) : now.getTime();
  return end != null && end < nowMs;
}

/** Supabase の .or() に渡す「まだ終わっていない(開催中・これから)」の条件 */
export function notEndedEventFilter(now: Date = new Date()): string {
  const cutoff = new Date(now.getTime() - NO_END_GRACE_MS).toISOString();
  return `and(end_at.not.is.null,end_at.gte.${now.toISOString()}),and(end_at.is.null,start_at.gte.${cutoff})`;
}
