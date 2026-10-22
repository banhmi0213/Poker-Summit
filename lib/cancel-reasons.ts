// 勤務キャンセルの理由(DBの public.cancel_spot_work と同じコード、2026/10/22)
export const CANCEL_REASONS: [string, string][] = [["illness","体調不良"],["urgent","急用"],["store_reason","店舗の都合"],["no_contact","相手と連絡が取れない"],["conditions","条件の食い違い"],["other","その他"]];
export const cancelReasonLabel = (code?: string | null) => CANCEL_REASONS.find(([c]) => c === code)?.[1] ?? "";
