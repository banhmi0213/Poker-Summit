export const DEALER_HOURLY_WAGES = Array.from({ length: 14 }, (_, i) => 1200 + i * 100);
export function validDealerWage(min: number | null, max: number | null): boolean {
  if (min === null && max === null) return true;
  return min !== null && max !== null && DEALER_HOURLY_WAGES.includes(min) && DEALER_HOURLY_WAGES.includes(max) && min <= max;
}
export function formatDealerWage(min: number | null | undefined, max: number | null | undefined): string {
  return min != null && max != null ? `${min.toLocaleString("ja-JP")}円〜${max.toLocaleString("ja-JP")}円` : "未設定";
}
