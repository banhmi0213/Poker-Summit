// Supabase の認証エラー(英語)を、画面に出す日本語に直す(2026/10)。
const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, "メールアドレスまたはパスワードが正しくありません。"],
  [/email not confirmed/i, "メールアドレスの確認が済んでいません。登録時に届いた確認メールのリンクを押してください。"],
  [/user already registered|already been registered/i, "このメールアドレスはすでに登録されています。ログインするか、パスワードを忘れた方はパスワードの再設定をご利用ください。"],
  [/password should be at least|password is too short/i, "パスワードが短すぎます。"],
  // 過去にほかのサイトから流出したパスワード(Supabaseの流出チェック)。何がだめか分かるように具体的に(2026/10/20)
  [/password.*(weak|known|leaked|pwned)|weak password/i, "このパスワードは、過去にほかのサービスから流出したことがあるため、安全のため使えません。ほかのサイトで使っていない、英字と数字を組み合わせたパスワードを入れてください。（まだ登録は完了していません）"],
  [/new password should be different/i, "新しいパスワードは、今のパスワードと別のものにしてください。"],
  [/unable to validate email|invalid email|email address .* is invalid/i, "メールアドレスの形式が正しくありません。"],
  [/rate limit|too many requests|security purposes/i, "短時間に操作が続いたため、しばらく時間をおいてからもう一度お試しください。"],
  [/user is banned|user banned/i, "このアカウントはご利用いただけません。"],
  [/email link is invalid|token has expired|otp.*expired|link.*expired/i, "リンクの有効期限が切れています。もう一度手続きをやり直してください。"],
  [/signups not allowed|signup is disabled/i, "現在、新規登録を受け付けていません。"],
  [/same email|email.*already.*use|email_exists/i, "このメールアドレスはすでに使われています。"],
  [/reauthentication|reauthenticate/i, "安全のため、もう一度ログインしてからお試しください。"],
];

export function authErrorMessage(message: string | null | undefined): string {
  const m = String(message ?? "");
  for (const [re, ja] of MESSAGES) if (re.test(m)) return ja;
  // 日本語のメッセージ(自前のエラー)はそのまま、それ以外は一般的な文に
  return /[ぁ-んァ-ン一-龥]/.test(m) ? m : "うまく処理できませんでした。時間をおいてもう一度お試しください。";
}
