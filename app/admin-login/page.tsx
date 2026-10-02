import Link from "next/link";
import { adminSignIn } from "./actions";

// 総合管理画面専用のログイン画面(2026/10、「adminは専用のログイン画面
// 作って」との指示を受けて/loginから分離)。見た目・導線は/store/loginと
// 同じ構成だが、ログインはメールアドレス+パスワード(会員ログインと同じ
// Supabase Auth)で、権限はadmin_usersテーブルで判定する。URLが/admin/login
// ではなく/admin-loginなのは、app/admin/layout.tsxの認証チェックに
// 巻き込まれてリダイレクトループになるのを避けるため(詳細はactions.tsの
// コメント参照)。
export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const params = searchParams;
  const next = params.next ?? "";

  return (
    <div className="container" style={{ maxWidth: 380, paddingTop: 60 }}>
      <div className="auth-brand-wrap" style={{ margin: "0 0 20px" }}>
        <div className="brand wordmark">
          <img className="logo-img" src="/images/logo.png" alt="Poker Summit" />
        </div>
      </div>
      <div className="card">
        <h1 style={{ fontSize: 18, marginBottom: 4 }}>総合管理ログイン</h1>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
          運営アカウント(admin_users登録済み)のメールアドレスとパスワードでログインしてください。
        </p>
        {params.error && <p className="err">{params.error}</p>}
        <form action={adminSignIn}>
          <input type="hidden" name="next" value={next} />
          <div className="field">
            <span className="muted">メールアドレス</span>
            <input type="email" name="email" required autoComplete="email" />
          </div>
          <div className="field">
            <span className="muted">パスワード</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn primary" style={{ width: "100%" }}>
            ログイン
          </button>
        </form>
        <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
          会員の方は<Link href="/login">こちらから会員ログイン</Link>
        </p>
        <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
          店舗の方は<Link href="/store/login">こちらから店舗管理ログイン</Link>
        </p>
      </div>
    </div>
  );
}
