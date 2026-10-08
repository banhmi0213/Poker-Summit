import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { changeStorePassword } from "../password-actions";
import { PASSWORD_INPUT_PATTERN, PASSWORD_MIN_LENGTH, PASSWORD_RULE_LABEL } from "@/lib/password-policy";

// app/account/password/page.tsx (会員・総合管理画面用)の店舗版。店舗用
// Cookie(STORE_AUTH_COOKIE_NAME)のセッションに対してパスワードを変更する
// (2026/09/30、店舗/管理者セッション分離に伴い新設)。
export default async function StorePasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/store/login?next=/store/profile/password");
  }

  const params = searchParams;

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>パスワード変更</h1>
      <div className="card" style={{ maxWidth: 400 }}>
        {params.error && <p className="err">{params.error}</p>}
        {params.done && (
          <p className="muted" style={{ marginBottom: 12, color: "var(--good)" }}>
            パスワードを変更しました。
          </p>
        )}
        <form action={changeStorePassword}>
          <div className="field">
            <span className="muted">新しいパスワード（{PASSWORD_RULE_LABEL}）</span>
            <input type="password" name="password" required minLength={PASSWORD_MIN_LENGTH} pattern={PASSWORD_INPUT_PATTERN} title={PASSWORD_RULE_LABEL} autoComplete="new-password" />
          </div>
          <div className="field">
            <span className="muted">新しいパスワード（確認）</span>
            <input type="password" name="passwordConfirm" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn primary" style={{ width: "100%" }}>
            変更する
          </button>
        </form>
      </div>
    </div>
  );
}
