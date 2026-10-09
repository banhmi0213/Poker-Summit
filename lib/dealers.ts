export const DEALER_GAMES = ["テキサスホールデム", "オマハ（PLO）", "オマハハイロー", "ショートデック", "セブンカードスタッド", "ラズ", "ドロー", "ミックスゲーム", "その他"];
export type DealerAvatarKind = "male" | "female";
export const DEALER_CONTRACT_STATUSES = ["契約可能", "契約済み"] as const;
export type DealerContractStatus = typeof DEALER_CONTRACT_STATUSES[number];
export function validDealerAvailability(type: string, status: string, regions: string, hours: string): boolean {
 return DEALER_CONTRACT_STATUSES.some(s => s === status) && regions.length <= 300 && hours.length <= 500 &&
  (type !== "フリーディーラー" || Boolean(regions.trim() && hours.trim()));
}
export type DealerProfile = { user_id: string; full_name: string; age: number; pref: string; games: string[]; experience_years: number; appeal: string; photo_url: string | null; avatar_kind: DealerAvatarKind | null; dealer_type: string; published: boolean; available_dates: string[]; contract_status: DealerContractStatus; available_regions: string; available_hours: string };
