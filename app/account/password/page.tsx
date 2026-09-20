import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { changePassword } from "./actions";

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
            <span>新しいパスワード（6文字以上）</span>
            <input type="password" name="password" required minLength={6} />
          </div>
          <div className="field">
            <span>新しいパスワード（確認）</span>
            <input type="password" name="passwordConfirm" required minLength={6} />
          </div>
          <button type="submit" className="btn primary" style={{ width: "100%" }}>
            変更する
          </button>
        </form>
      </div>
    </div>
  );
}
