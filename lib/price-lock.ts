// 年内お申込み特典(料金据え置き、2026/10)。
// 据え置きの付与・解除はデータベース側(store_contracts のトリガー)で行う:
// - 付与: 特典の受付中(site_settings.price_lock_campaign_enabled かつ期限内)に契約が作られたとき
//   (契約は初回の決済完了・入金確認の後に作られる)
// - 解除: プラン変更・未払いによる掲載停止・解約のどれか(一度外れたら戻らない)
// ここでは「次の請求でいくら取るか」を決めるだけ。値下げした場合は下がった料金を使う。

export type PriceLockFields = {
  price_lock_plan_id?: string | null;
  price_lock_fee?: number | null;
  price_lock_ended_at?: string | null;
};

export const PRICE_LOCK_COLUMNS = "price_lock_plan_id, price_lock_fee, price_lock_ended_at";

/** 据え置きが今も有効か(対象プランのまま、外れていない) */
export function isPriceLockActive(contract: PriceLockFields & { plan_id?: string | null }): boolean {
  return (
    !!contract.price_lock_plan_id &&
    contract.price_lock_fee != null &&
    !contract.price_lock_ended_at &&
    contract.plan_id === contract.price_lock_plan_id
  );
}

/** 請求に使うプラン料金。据え置き中で同じプランなら、据え置き料金と今の料金の安い方 */
export function effectivePlanFee(contract: PriceLockFields, planId: string, currentFee: number): number {
  if (
    contract.price_lock_plan_id === planId &&
    contract.price_lock_fee != null &&
    !contract.price_lock_ended_at
  ) {
    return Math.min(contract.price_lock_fee, currentFee);
  }
  return currentFee;
}
