// プランを上げたときの日割り差額(2026/10、毎月払いのカード契約)。
// - 上げた当日は「使った日」として数えない(残りの日数は翌日から契約期間の終わりまで)
// - 1円未満は切り捨て(どちらもお店に有利な数え方)
// - 次の更新日は変えない(更新日からは新しいプランの月額)

const DAY = 86_400_000;
const JST = 9 * 3_600_000;

/** periodEndIso の1か月前(月末は月末に丸める) */
function oneMonthBefore(ms: number) {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime();
}

export function prorateUpgrade(params: { oldMonthly: number; newMonthly: number; periodEndIso: string | null; now?: Date }) {
  const now = (params.now ?? new Date()).getTime();
  const diffMonthly = params.newMonthly - params.oldMonthly;
  if (!params.periodEndIso) return { charge: null as number | null, remainingDays: 0, periodDays: 0, diffMonthly };
  const end = Date.parse(params.periodEndIso);
  if (!Number.isFinite(end) || end <= now) return { charge: null as number | null, remainingDays: 0, periodDays: 0, diffMonthly };
  const periodDays = Math.max(1, Math.round((end - oneMonthBefore(end)) / DAY));
  // 日本時間の「明日の0時」から契約期間の終わりまでの丸1日の数
  const tomorrowStart = Math.floor((now + JST) / DAY) * DAY - JST + DAY;
  const remainingDays = Math.max(0, Math.min(periodDays, Math.floor((end - tomorrowStart) / DAY)));
  const charge = diffMonthly > 0 ? Math.floor((diffMonthly * remainingDays) / periodDays) : 0;
  return { charge, remainingDays, periodDays, diffMonthly };
}
