// ハンドルネームの確認(2026/10/20)。掲示板は匿名なし(荒れる元になるため)、名前はハンドルネームに固定。
// 運営になりすませないよう、運営・公式・サイト名を含む名前は会員には使わせない
// (運営アカウントは admin_users.board_official で「運営」バッジを付けて区別する)。
export const HANDLE_NAME_MAX = 20;
const RESERVED_RE = /(運営|公式|事務局|管理人|poker\s*summit|ポーカーサミット|admin|official)/i;

export function handleNameError(name: string): string | null {
  if (!name) return "ハンドルネームを入力してください。";
  if (name.length > HANDLE_NAME_MAX) return `ハンドルネームは${HANDLE_NAME_MAX}文字以内で入力してください。`;
  if (RESERVED_RE.test(name.normalize("NFKC"))) return "「運営」「公式」やサイト名を含むハンドルネームは使えません。";
  return null;
}
