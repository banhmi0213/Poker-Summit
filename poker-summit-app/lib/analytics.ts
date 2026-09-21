export type AnalyticsFilters = {
  period: string;
  from?: string;
  to?: string;
};

export function analyticsPeriodDays(f: AnalyticsFilters): number {
  if (f.period === "7") return 7;
  if (f.period === "90") return 90;
  if (f.period === "custom" && f.from && f.to) {
    const d1 = new Date(f.from);
    const d2 = new Date(f.to);
    const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
    if (diff > 0) return Math.min(365, diff);
  }
  return 30;
}

export function analyticsPeriodLabel(f: AnalyticsFilters): string {
  if (f.period === "7") return "過去7日";
  if (f.period === "90") return "過去90日";
  if (f.period === "custom") {
    return f.from && f.to ? `${f.from}〜${f.to}` : "期間指定";
  }
  return "過去30日";
}

export function analyticsSince(f: AnalyticsFilters): Date {
  const days = analyticsPeriodDays(f);
  if (f.period === "custom" && f.from) {
    return new Date(f.from);
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

export function trendGranularityLabel(f: AnalyticsFilters): string {
  const days = analyticsPeriodDays(f);
  if (days <= 7) return "日次";
  if (days <= 45) return "週次";
  return "隔週";
}

/** Buckets a set of timestamps (ISO strings) into 7 equal-width buckets across
 * the period, and returns counts + labels matching the prototype's
 * trendBucketLabels() (today/N日前 for a short period, today/N週前 for a
 * longer one, etc.) — computed from real page_views rows instead of a fake
 * weekFactors curve. */
export function bucketTrend(timestamps: string[], f: AnalyticsFilters): { counts: number[]; labels: string[] } {
  const days = analyticsPeriodDays(f);
  const n = 7;
  const now = new Date();
  const since = analyticsSince(f);
  const spanMs = Math.max(1, now.getTime() - since.getTime());
  const bucketMs = spanMs / n;

  const counts = new Array(n).fill(0);
  timestamps.forEach((ts) => {
    const t = new Date(ts).getTime();
    if (t < since.getTime()) return;
    let idx = Math.floor((t - since.getTime()) / bucketMs);
    if (idx < 0) idx = 0;
    if (idx > n - 1) idx = n - 1;
    counts[idx]++;
  });

  let labels: string[];
  if (days <= 7) {
    labels = Array.from({ length: n }, (_, i) => {
      const rem = n - 1 - i;
      return rem === 0 ? "今日" : `${rem}日前`;
    });
  } else if (days <= 45) {
    labels = Array.from({ length: n }, (_, i) => {
      const rem = n - 1 - i;
      return rem === 0 ? "今週" : `${rem}週前`;
    });
  } else {
    labels = Array.from({ length: n }, (_, i) => {
      const rem = n - 1 - i;
      return rem === 0 ? "直近" : `${rem * 2}週前`;
    });
  }
  return { counts, labels };
}

export type AnalyticsIssue = {
  cls: "critical" | "warning" | "outline";
  icon: string;
  text: string;
  href: string;
};
