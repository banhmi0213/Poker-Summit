import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setMemberSuspended, sendMemberPasswordReset, deleteMember } from "../actions";

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
  ]);

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
        {!member.is_admin && (
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
              この会員を完全に削除する
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
