import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL } from "@/lib/constants";
import {
  toggleFavoriteStore,
  toggleFavoriteJob,
  applyToJob,
  joinEvent,
  useCoupon,
} from "@/app/member-actions";
import { reportStore, reportJob } from "@/app/report-actions";
import { PortalHeader } from "@/app/portal-header";

export default async function StoreDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", params.id)
    .in("status", ["approved", "listed"])
    .maybeSingle();

  if (!store) {
    notFound();
  }

  const path = `/stores/${store.id}`;
  const referrer = (await headers()).get("referer") ?? null;

  supabase
    .from("page_views")
    .insert({ path, store_id: store.id, referrer })
    .then(() => {});

  const { data: events } = await supabase
    .from("events")
    .select("id, title, location, start_at")
    .eq("store_id", store.id)
    .eq("status", "published")
    .order("start_at", { ascending: true });

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, job_type, salary, description, posted_at")
    .eq("store_id", store.id)
    .eq("status", "open")
    .order("posted_at", { ascending: false });

  const { data: coupons } = await supabase
    .from("coupons")
    .select("id, title, discount, description, code, valid_until, usage_limit, used_count")
    .eq("store_id", store.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  let isFavoriteStore = false;
  let favoriteJobIds = new Set<string>();
  let appliedJobIds = new Set<string>();
  let joinedEventIds = new Set<string>();
  let usedCouponIds = new Set<string>();

  if (user) {
    const [
      { data: favStore },
      { data: favJobs },
      { data: apps },
      { data: parts },
      { data: uses },
    ] = await Promise.all([
      supabase
        .from("favorite_stores")
        .select("store_id")
        .eq("user_id", user.id)
        .eq("store_id", store.id)
        .maybeSingle(),
      supabase.from("favorite_jobs").select("job_id").eq("user_id", user.id),
      supabase.from("job_applications").select("job_id").eq("user_id", user.id),
      supabase
        .from("event_participants")
        .select("event_id")
        .eq("user_id", user.id),
      supabase.from("coupon_uses").select("coupon_id").eq("user_id", user.id),
    ]);

    isFavoriteStore = !!favStore;
    favoriteJobIds = new Set((favJobs ?? []).map((f) => f.job_id));
    appliedJobIds = new Set((apps ?? []).map((a) => a.job_id));
    joinedEventIds = new Set((parts ?? []).map((p) => p.event_id));
    usedCouponIds = new Set((uses ?? []).map((u) => u.coupon_id));
  }

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <h1 style={{ fontSize: 24 }}>{store.name}</h1>
          {store.category && (
            <span className="badge">
              {CATEGORY_LABEL[store.category] ?? store.category}
            </span>
          )}
        </div>
        <p className="muted" style={{ marginBottom: 12 }}>
          {[store.region, store.pref, store.city].filter(Boolean).join(" / ")}
        </p>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          <form
            action={async () => {
              "use server";
              await toggleFavoriteStore(store.id, path);
            }}
          >
            <button type="submit" className={`btn ${isFavoriteStore ? "primary" : ""}`}>
              {isFavoriteStore ? "★ お気に入り済み" : "☆ お気に入りに追加"}
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await reportStore(store.id, path);
            }}
          >
            <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
              この店舗を通報する
            </button>
          </form>
        </div>

        <div className="card">
          {store.description && <p style={{ marginBottom: 12 }}>{store.description}</p>}
          <table>
            <tbody>
              {store.address && (
                <tr>
                  <th style={{ width: 110 }}>住所</th>
                  <td>{store.address}</td>
                </tr>
              )}
              {store.tel && (
                <tr>
                  <th>電話番号</th>
                  <td>{store.tel}</td>
                </tr>
              )}
              {store.hours && (
                <tr>
                  <th>営業時間</th>
                  <td>{store.hours}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>イベント</h2>
        {(!events || events.length === 0) && (
          <p className="muted">現在開催予定のイベントはありません。</p>
        )}
        {events?.map((ev) => (
          <div className="card" key={ev.id}>
            <Link href={`/events/${ev.id}`}>
              <h3>{ev.title}</h3>
              {ev.location && <p className="muted">{ev.location}</p>}
            </Link>
            <form
              action={async () => {
                "use server";
                await joinEvent(ev.id, path);
              }}
              style={{ marginTop: 8 }}
            >
              <button
                type="submit"
                className={`btn ${joinedEventIds.has(ev.id) ? "primary" : ""}`}
                style={{ fontSize: 12.5 }}
              >
                {joinedEventIds.has(ev.id) ? "参加予定" : "参加予定にする"}
              </button>
            </form>
          </div>
        ))}

        <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>求人情報</h2>
        {(!jobs || jobs.length === 0) && (
          <p className="muted">現在募集中の求人はありません。</p>
        )}
        {jobs?.map((j) => (
          <div className="card" key={j.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <h3>{j.title}</h3>
              {j.job_type && <span className="badge">{j.job_type}</span>}
            </div>
            {j.salary && <p className="muted">{j.salary}</p>}
            {j.description && <p style={{ marginTop: 6, fontSize: 13.5 }}>{j.description}</p>}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <form
                action={async () => {
                  "use server";
                  await toggleFavoriteJob(j.id, path);
                }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  {favoriteJobIds.has(j.id) ? "★ お気に入り済み" : "☆ お気に入り"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await applyToJob(j.id, path);
                }}
              >
                <button
                  type="submit"
                  className={`btn ${appliedJobIds.has(j.id) ? "" : "primary"}`}
                  style={{ fontSize: 12.5 }}
                  disabled={appliedJobIds.has(j.id)}
                >
                  {appliedJobIds.has(j.id) ? "応募済み" : "応募する"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await reportJob(j.id, path);
                }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  通報
                </button>
              </form>
            </div>
          </div>
        ))}

        <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>クーポン</h2>
        {(!coupons || coupons.length === 0) && (
          <p className="muted">現在利用可能なクーポンはありません。</p>
        )}
        {coupons?.map((c) => {
          const limitReached =
            c.usage_limit != null && (c.used_count ?? 0) >= c.usage_limit;
          const alreadyUsed = usedCouponIds.has(c.id);
          return (
            <div className="card" key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <h3>{c.title}</h3>
                {c.discount && <span className="badge">{c.discount}</span>}
              </div>
              {c.description && <p style={{ marginTop: 6, fontSize: 13.5 }}>{c.description}</p>}
              <div className="muted" style={{ marginTop: 6 }}>
                {c.code && <>クーポンコード: {c.code} </>}
                {c.valid_until && <>(有効期限: {c.valid_until})</>}
              </div>
              <form
                action={async () => {
                  "use server";
                  await useCoupon(c.id, path);
                }}
                style={{ marginTop: 8 }}
              >
                <button
                  type="submit"
                  className={`btn ${alreadyUsed ? "" : "primary"}`}
                  disabled={alreadyUsed || (limitReached && !alreadyUsed)}
                >
                  {alreadyUsed
                    ? "✓ 使用済みです"
                    : limitReached
                    ? "利用上限に達しました"
                    : "クーポンを使う"}
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
