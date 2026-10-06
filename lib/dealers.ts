export const DEALER_GAMES = ["テキサスホールデム", "オマハ（PLO）", "オマハハイロー", "ショートデック", "セブンカードスタッド", "ラズ", "ドロー", "ミックスゲーム", "その他"];
export type DealerProfile = { user_id: string; full_name: string; age: number; pref: string; games: string[]; experience_years: number; appeal: string; photo_url: string | null; dealer_type: string; published: boolean };
