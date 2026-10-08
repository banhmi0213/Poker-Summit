// パスワードのルール(2026/10)。Supabase Auth側の設定
// (最低8文字・英字と数字を必須)と揃えておくこと。
// 大文字・記号までは求めない。

export const PASSWORD_MIN_LENGTH = 8;

/** 画面に出す説明文 */
export const PASSWORD_RULE_LABEL = "8文字以上・英字と数字を両方含む";

/** <input pattern> 用(ブラウザ側の事前チェック) */
export const PASSWORD_INPUT_PATTERN = "(?=.*[A-Za-z])(?=.*[0-9]).{8,}";

/** ルールを満たさない場合はエラーメッセージ、満たせば null */
export function passwordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return `パスワードは${PASSWORD_RULE_LABEL}ものを入力してください。`;
  }
  return null;
}

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";

function randomIndex(max: number) {
  // 推測されにくいよう Math.random ではなく暗号論的乱数を使う
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

/**
 * 店舗に発行する初期パスワード。紛らわしい文字(0/O, 1/l/I)を除き、
 * 英字と数字を必ず1文字以上含める。
 */
export function generateStorePassword(length = 10): string {
  const all = LETTERS + DIGITS;
  const chars = [LETTERS[randomIndex(LETTERS.length)], DIGITS[randomIndex(DIGITS.length)]];
  while (chars.length < Math.max(length, PASSWORD_MIN_LENGTH)) chars.push(all[randomIndex(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
