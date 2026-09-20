import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import {
  toggleFavoriteStore,
  toggleFavoriteJob,
  leaveEvent,
} from "@/app/member-actions";

export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/mypage");
  }

  const { data: favStoreRows } = await supabase
    .from("favorite_stores")
    .select("stores(id, name, category, pref)")
    .eq("user_id", user.id);

  const { data: favJobRows } = await supabase
    .from("favorite_jobs")
    .select("jobs(id, title, store_id, stores(name))")
    .eq("user_id", user.id);

  const { data: applications } = await supabase
    .from("job_applications")
    .select("applied_at, jobs(id, title, store_id, stores(name))")
    .eq("user_id", user.id)
    .order("applied_at", { ascending: false });

  const { data: participations } = await supabase
    .from("event_participants")
    .select("event_id, events(id, title, start_at)")
    .eq("user_id", user.id);

  const { data: couponUses } = await supabase
    .from("coupon_uses")
    .select("used_at, coupons(id, title, store_id, stores(name))")
    .eq("user_id", user.id)
    .order("used_at", { ascending: false });

  return (
    <div>
      <header className="header">
        <Link href="/" className="brand">
          Poker Summit
        </Link>
        <form action={signOut}>
          <button type="submit" className="btn">
            ログアウト ({user.email})
          </button>
        </form>
      </header>
      <div className="container">
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>マイページ</h1>

        <h2 style={{ fontSize: 16, marginBottom: 10 }}>♥ お気に入り店舗</h2>
        {(!favStoreRows || favStoreRows.length === 0) && (
          <p className="muted">お気に入り登録した店舗はありません。</p>
        )}
        {favStoreRows?.map((row: any) => {
          const s = row.stores;
          if (!s) return null;
          return (
            <div className="card" key={s.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <Link href={`/stores/${s.id}`}>{s.name}</Link>
                <form
                  action={async () => {
                    "use server";
                    await toggleFavoriteStore(s.id, "/mypage");
                  }}
                >
                  <button type="submit" className="btn" style={{ fontSize: 12 }}>
                    削除
                  </button>
                </form>
              </div>
            </div>
          );
        })}

        <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>☆ お気に入り求人</h2>
        {(!favJobRows || favJobRows.length === 0) && (
          <p className="muted">お気に入り登録した求人はありません。</p>
        )}
        {favJobRows?.map((row: any) => {
          const j = row.jobs;
          if (!j) return null;
          return (
            <div className="card" key={j.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <Link href={`/stores/${j.store_id}`}>
                  {j.title}（{j.stores?.name}）
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await toggleFavoriteJob(j.id, "/mypage");
                  }}
                >
                  <button type="submit" className="btn" style={{ fontSize: 12 }}>
                    削除
                  </button>
                </form>
              </div>
            </div>
          );
        })}

        <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>
          💼 応募した求人
        </h2>
        {(!applications || applications.length === 0) && (
          <p className="muted">応募した求人はありません。</p>
        )}
        {applications?.map((row: any) => {
          const j = row.jobs;
          if (!j) return null;
          return (
            <div className="card" key={j.id}>
              <Link href={`/stores/${j.store_id}`}>
                {j.title}（{j.stores?.name}）
              </Link>
            </div>
          );
        })}

        <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>
          🎉 参加予定のイベント
        </h2>
        {(!participations || participations.length === 0) && (
          <p className="muted">参加予定のイベントはありません。</p>
        )}
        {participations?.map((row: any) => {
          const ev = row.events;
          if (!ev) return null;
          return (
            <div className="card" key={ev.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <Link href={`/events/${ev.id}`}>{ev.title}</Link>
                <form
                  action={async () => {
                    "use server";
                    await leaveEvent(ev.id, "/mypage");
                  }}
                >
                  <button type="submit" className="btn" style={{ fontSize: 12 }}>
                    参加取消
                  </button>
                </form>
              </div>
            </div>
          );
        })}

        <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>
          🎟️ クーポン利用履歴
        </h2>
        {(!couponUses || couponUses.length === 0) && (
          <p className="muted">利用したクーポンはありません。</p>
        )}
        {couponUses?.map((row: any) => {
          const c = row.coupons;
          if (!c) return null;
          return (
            <div className="card" key={c.id}>
              <Link href={`/stores/${c.store_id}`}>
                {c.title}（{c.stores?.name}）
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
