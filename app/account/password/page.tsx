import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { changePassword } from "./actions";
import { PASSWORD_INPUT_PATTERN, PASSWORD_MIN_LENGTH, PASSWORD_RULE_LABEL } from "@/lib/password-policy";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/password");
  }

  const params = searchParams;

  return (
    <div className="container" style={{ maxWidth: 400, paddingTop: 40 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>パスワード変更</h1>
      <div className="card">
        {params.error && <p className="err">{params.error}</p>}
        {params.done && (
          <p className="muted" style={{ marginBottom: 12, color: "var(--good)" }}>
            パスワードを変更しました。
          </p>
        )}
        <form action={changePassword}>
          <div className="field">
            <span>新しいパスワード（{PASSWORD_RULE_LABEL}）</span>
            <input type="password" name="password" required minLength={PASSWORD_MIN_LENGTH} pattern={PASSWORD_INPUT_PATTERN} title={PASSWORD_RULE_LABEL} autoComplete="new-password" />
          </div>
          <div className="field">
            <span>新しいパスワード（確認）</span>
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
