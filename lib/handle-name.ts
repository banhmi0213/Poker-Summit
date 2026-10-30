// ハンドルネームの確認(2026/10/20)。掲示板は匿名なし(荒れる元になるため)、名前はハンドルネームに固定。
// 運営になりすませないよう、運営・公式・サイト名を含む名前は会員には使わせない
// (運営アカウントは admin_users.board_official で「運営」バッジを付けて区別する)。
// 文字数(オーナー指示 2026/10/30): 卓の名札(PC)にきれいに収まる長さ。日本語を含むなら7文字、英数字・記号だけなら12文字まで。
// これより長い名前をすでに使っている会員はそのまま使える(名前を変えるときだけ確認する)。卓では最後が「…」になる。
export const HANDLE_NAME_MAX = 7;
export const HANDLE_NAME_ASCII_MAX = 12;
export const HANDLE_NAME_NOTICE = `${HANDLE_NAME_MAX}文字まで（英数字だけなら${HANDLE_NAME_ASCII_MAX}文字まで）`;
const RESERVED_RE = /(運営|公式|事務局|管理人|poker\s*summit|ポーカーサミット|admin|official)/i;

export function handleNameError(name: string): string | null {
  if (!name) return "ハンドルネームを入力してください。";
  const ascii = /^[\x20-\x7E]+$/.test(name);
  if (Array.from(name).length > (ascii ? HANDLE_NAME_ASCII_MAX : HANDLE_NAME_MAX)) return `ハンドルネームは${HANDLE_NAME_NOTICE}で入力してください。`;
  if (RESERVED_RE.test(name.normalize("NFKC"))) return "「運営」「公式」やサイト名を含むハンドルネームは使えません。";
  return null;
}
