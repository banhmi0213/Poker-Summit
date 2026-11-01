import { PasswordInput } from "@/app/password-input";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { changePassword } from "./actions";
import { PASSWORD_INPUT_PATTERN, PASSWORD_MIN_LENGTH, PASSWORD_RULE_LABEL } from "@/lib/password-policy";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string; from?: string };
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
        {params.done ? (
          // 変更できたら入力欄は出さない(「まだ終わってないのかな」と迷わないように)
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <p style={{ fontWeight: 700, color: "var(--good)", marginBottom: 6 }}>✓ パスワードを変更しました</p>
            <p className="muted small" style={{ marginBottom: 16 }}>次回から新しいパスワードでログインしてください。</p>
            <a className="btn primary" style={{ width: "100%", display: "flex", justifyContent: "center" }} href={params.from === "admin" ? "/admin" : "/mypage"}>
              {params.from === "admin" ? "総合管理画面へ" : "マイページへ"}
            </a>
          </div>
        ) : (
          <form action={changePassword}>
            {params.from === "admin" && <input type="hidden" name="from" value="admin" />}
            {/* パスワード保存機能が「どのアカウントの新しいパスワードか」を判断するための欄(画面には出さない) */}
            <input type="email" name="username" autoComplete="username" value={user.email ?? ""} readOnly hidden />
            <div className="field">
              <span>新しいパスワード（{PASSWORD_RULE_LABEL}）</span>
              <PasswordInput name="password" required minLength={PASSWORD_MIN_LENGTH} pattern={PASSWORD_INPUT_PATTERN} title={PASSWORD_RULE_LABEL} autoComplete="new-password" />
            </div>
            <div className="field">
              <span>新しいパスワード（確認）</span>
              <PasswordInput name="passwordConfirm" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn primary" style={{ width: "100%" }}>
              変更する
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
