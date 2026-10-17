import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteOwnAccount } from "./actions";
import { WITHDRAWAL_REASONS } from "./reasons";

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/delete");
  }

  return (
    <div className="container" style={{ maxWidth: 440, paddingTop: 40 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>退会</h1>
      <div className="card" style={{ borderColor: "var(--critical)" }}>
        {searchParams.error && <p className="err">{searchParams.error}</p>}
        <p style={{ marginBottom: 10 }}>
          退会すると、このアカウントとお気に入り・応募履歴・投稿との紐付けなど、アカウントに関する情報が削除されます。
          <span style={{ display: "block", marginTop: 6, fontSize: 13.5, color: "var(--muted)", overflowWrap: "anywhere" }}>対象のアカウント：{user.email}</span>
        </p>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 18 }}>
          ※掲示板への投稿自体は残りますが、投稿者アカウントとの紐付けは解除されます。
          <br />
          ※ディーラーとして店舗とのお仕事（応募・チャット等）の記録がある場合、その記録は相手の店舗とのやり取りの記録として残ります（お名前・連絡先などの個人情報は削除します）。詳しくは<a href="/privacy">プライバシーポリシー</a>第12条をご覧ください。
          <br />
          ※この操作は取り消せません。
        </p>
        <form action={deleteOwnAccount} data-no-draft>
          <fieldset style={{ border: "1px solid #eee", borderRadius: 8, padding: "10px 12px", marginBottom: 14, minWidth: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 4px" }}>退会の理由（任意）</legend>
            <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>今後の改善のためにお聞かせください。答えなくても退会できます。</p>
            <select name="reason" defaultValue="" style={{ width: "100%", marginBottom: 8 }}>
              <option value="">選択しない</option>
              {WITHDRAWAL_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <textarea name="comment" rows={3} maxLength={1000} placeholder="ご意見があればご記入ください" style={{ width: "100%", boxSizing: "border-box" }} />
          </fieldset>
          <button
            type="submit"
            className="btn"
            style={{ width: "100%", background: "var(--critical)", color: "#fff", borderColor: "var(--critical)" }}
          >
            退会する（元に戻せません）
          </button>
        </form>
      </div>
    </div>
  );
}
