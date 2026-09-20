import { signIn } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const params = searchParams;
  const next = params.next ?? "/admin/stores";

  return (
    <div className="container" style={{ maxWidth: 380, paddingTop: 60 }}>
      <div className="brand" style={{ textAlign: "center", marginBottom: 20 }}>
        Poker Summit
      </div>
      <div className="card">
        {params.error && <p className="err">{params.error}</p>}
        <form action={signIn}>
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
      </div>
    </div>
  );
}
