export const M_HOLDEM_ID_MAX_LENGTH = 64;
export const M_HOLDEM_PARTICIPATION_NOTICE = "ポーカーサミット主催トーナメントへの参加には、m HOLD’EM IDの登録が必要です。";
export function normalizeMHoldemId(value: unknown): string {
  return String(value ?? "").trim();
}
export function mHoldemIdError(value: string): string | null {
  if (value.length > M_HOLDEM_ID_MAX_LENGTH || /[\s\u0000-\u001f\u007f]/u.test(value)) {
    return "m HOLD’EM IDは空白を含めず、64文字以内で入力してください。";
  }
  return null;
}
