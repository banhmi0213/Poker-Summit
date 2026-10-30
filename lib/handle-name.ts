// ハンドルネームの文字数(オーナー指示 2026/10/30)。卓の名札(PC)にきれいに収まる長さ:
// 日本語を含むなら7文字まで、英数字・記号だけなら12文字まで。今より長い名前の会員はそのまま使え、卓では最後が「…」になる。
export const HANDLE_NAME_MAX = 7;
export const HANDLE_NAME_ASCII_MAX = 12;
export const HANDLE_NAME_NOTICE = `${HANDLE_NAME_MAX}文字まで（英数字だけなら${HANDLE_NAME_ASCII_MAX}文字まで）`;

export function handleNameError(name: string): string | null {
  if (!name) return null;
  const ascii = /^[\x20-\x7E]+$/.test(name);
  const length = Array.from(name).length;
  if (length > (ascii ? HANDLE_NAME_ASCII_MAX : HANDLE_NAME_MAX)) return `ハンドルネームは${HANDLE_NAME_NOTICE}で入力してください。`;
  return null;
}
