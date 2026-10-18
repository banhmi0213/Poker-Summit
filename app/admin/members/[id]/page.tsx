import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setMemberSuspended, sendMemberPasswordReset, deleteMember, confirmMemberEmail } from "../actions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function AdminMemberDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: members } = await supabase.rpc("admin_list_members");
  const member = members?.find((m: any) => m.id === params.id);

  if (!member) {
    notFound();
  }

  const [
    { data: favStores },
    { data: favJobs },
    { data: applications },
    { data: participations },
    { data: couponUses },
    { data: previousAccounts },
    { data: mHoldemRows },
  ] = await Promise.all([
    supabase
      .from("favorite_stores")
      .select("stores(id, name)")
      .eq("user_id", member.id),
    supabase
      .from("favorite_jobs")
      .select("jobs(id, title)")
      .eq("user_id", member.id),
    supabase
      .from("job_applications")
      .select("applied_at, jobs(id, title)")
      .eq("user_id", member.id),
    supabase
      .from("event_participants")
      .select("events(id, title)")
      .eq("user_id", member.id),
    supabase
      .from("coupon_uses")
      .select("used_at, coupons(id, title)")
      .eq("user_id", member.id),
    // 同じメールアドレス・電話番号で以前退会したアカウント(評価・実績・利用停止を引き継いでいる)
    supabase.rpc("admin_member_previous_accounts", { p_user_id: member.id }),
    supabase.rpc("admin_member_m_holdem_ids"),
  ]);
  // メール確認の状態と「登録完了メール」を送ったか(確認済みにするボタンの表示用)
  const { data: authInfo } = await createServiceRoleClient().auth.admin.getUserById(member.id);
  const emailConfirmed = !!authInfo?.user?.email_confirmed_at;
  const welcomeSent = !!authInfo?.user?.user_metadata?.welcome_email_sent_at;
  const mHoldemId = ((mHoldemRows ?? []) as { user_id: string; m_holdem_id: string }[]).find((r) => r.user_id === member.id)?.m_holdem_id ?? null;
  const withdrawn = String(member.email ?? "").endsWith("@withdrawn.invalid");

  return (
    <div>
      <Link href="/admin/members" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 会員一覧へ戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>会員詳細: {member.email}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        登録日: {formatDate(member.created_at)}
        {member.is_admin && <span className="badge" style={{ marginLeft: 8 }}>運営</span>}
        {member.store_id && (
          <span className="badge" style={{ marginLeft: 8 }}>
            店舗オーナー: {member.store_name}
          </span>
        )}
        {member.suspended && (
          <span
            className="badge"
            style={{ marginLeft: 8, background: "rgba(230, 80, 80, 0.14)", color: "var(--critical)" }}
          >
            利用停止中
          </span>
        )}
      </p>

      <p style={{ marginBottom: 20, fontSize: 14 }}>
        <strong>m HOLD&apos;EM ID：</strong>
        {mHoldemId ? <span style={{ userSelect: "all" }}>{mHoldemId}</span> : <span className="muted">未登録</span>}
      </p>

      {withdrawn && (
        <p className="muted" style={{ marginBottom: 16, fontSize: 13 }}>
          退会済みのアカウントです。ディーラーマッチングの記録を残すためにアカウントだけ残しています（個人情報は削除済み・ログイン不可）。
        </p>
      )}

      {(previousAccounts ?? []).length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid var(--critical)" }}>
          <strong>以前退会したアカウントと同じ人の可能性があります</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8 }}>
            {(previousAccounts as any[]).map((p) => (
              <li key={p.previous_user_id}>
                {p.matched_by === "phone" ? "電話番号" : "メールアドレス"}が一致（退会日: {p.withdrawn_at ? formatDate(p.withdrawn_at) : "不明"}）
                {p.was_suspended && <span style={{ color: "var(--critical)", fontWeight: 700 }}>・退会時に利用停止中 → この会員も自動で利用停止にしました</span>}
                ・<Link href={`/admin/members/${p.previous_user_id}`}>前のアカウント</Link>
              </li>
            ))}
          </ul>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>ディーラーの評価・実績は前のアカウントの分も合わせて店舗に表示されます。</p>
        </div>
      )}

      {!member.is_admin && !member.store_id && !withdrawn && (!emailConfirmed || !welcomeSent) && (
        <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid #e0a028" }}>
          <strong>{emailConfirmed ? "登録完了メールがまだ送られていません" : "メールアドレスの確認がまだです（ログインできません）"}</strong>
          <p className="muted" style={{ fontSize: 13, margin: "6px 0 10px", lineHeight: 1.7 }}>
            {emailConfirmed
              ? "運営で確認済みにした会員です。ボタンを押すと「登録が完了しました」メールを送り、ログインできることを本人に知らせます。"
              : "確認メールが届かない・期限切れになった方の救済用です。押すと確認済みになり、登録時のパスワードでログインできるようになります。あわせて「登録が完了しました」メールを送ります。本人のメールアドレスかは確認できていない点にご注意ください。"}
          </p>
          <form
            action={async () => {
              "use server";
              await confirmMemberEmail(member.id);
            }}
          >
            <button type="submit" className="btn primary">
              {emailConfirmed ? "登録完了メールを送る" : "メール確認済みにする"}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <form
          action={async () => {
            "use server";
            await setMemberSuspended(member.id, !member.suspended);
          }}
        >
          <button type="submit" className={`btn ${member.suspended ? "" : "primary"}`}>
            {member.suspended ? "利用停止を解除する" : "利用停止にする"}
          </button>
        </form>
        <form
          action={async () => {
            "use server";
            await sendMemberPasswordReset(member.email, member.id);
          }}
        >
          <button type="submit" className="btn">
            パスワードリセットメール送信
          </button>
        </form>
        {!member.is_admin && !withdrawn && (
          <form
            action={async () => {
              "use server";
              await deleteMember(member.id);
              redirect("/admin/members");
            }}
          >
            <button
              type="submit"
              className="btn"
              style={{ background: "var(--critical)", color: "#fff", borderColor: "var(--critical)" }}
            >
              この会員を削除（退会扱い）する
            </button>
          </form>
        )}
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>お気に入り店舗</h2>
      {(!favStores || favStores.length === 0) && (
        <p className="muted">なし</p>
      )}
      {favStores?.map((row: any, i: number) => (
        <div className="card" key={i}>{row.stores?.name}</div>
      ))}

      <h2 style={{ fontSize: 15, marginTop: 20, marginBottom: 10 }}>お気に入り求人</h2>
      {(!favJobs || favJobs.length === 0) && <p className="muted">なし</p>}
      {favJobs?.map((row: any, i: number) => (
        <div className="card" key={i}>{row.jobs?.title}</div>
      ))}

      <h2 style={{ fontSize: 15, marginTop: 20, marginBottom: 10 }}>応募した求人</h2>
      {(!applications || applications.length === 0) && <p className="muted">なし</p>}
      {applications?.map((row: any, i: number) => (
        <div className="card" key={i}>{row.jobs?.title}</div>
      ))}

      <h2 style={{ fontSize: 15, marginTop: 20, marginBottom: 10 }}>参加予定イベント</h2>
      {(!participations || participations.length === 0) && <p className="muted">なし</p>}
      {participations?.map((row: any, i: number) => (
        <div className="card" key={i}>{row.events?.title}</div>
      ))}

      <h2 style={{ fontSize: 15, marginTop: 20, marginBottom: 10 }}>クーポン利用履歴</h2>
      {(!couponUses || couponUses.length === 0) && <p className="muted">なし</p>}
      {couponUses?.map((row: any, i: number) => (
        <div className="card" key={i}>{row.coupons?.title}</div>
      ))}
    </div>
  );
}
