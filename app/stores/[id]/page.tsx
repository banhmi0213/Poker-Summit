import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL } from "@/lib/constants";

export default async function StoreDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", params.id)
    .in("status", ["approved", "listed"])
    .maybeSingle();

  if (!store) {
    notFound();
  }

  supabase
    .from("page_views")
    .insert({ path: `/stores/${store.id}`, store_id: store.id })
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
    .select("id, title, discount, description, code, valid_until")
    .eq("store_id", store.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  return (
    <div>
      <header className="header">
        <div className="brand">Poker Summit</div>
        <Link href="/" className="btn">
          店舗一覧へ戻る
        </Link>
      </header>
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
        <p className="muted" style={{ marginBottom: 20 }}>
          {[store.region, store.pref, store.city].filter(Boolean).join(" / ")}
        </p>

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
          <Link href={`/events/${ev.id}`} key={ev.id} style={{ display: "block" }}>
            <div className="card">
              <h3>{ev.title}</h3>
              {ev.location && <p className="muted">{ev.location}</p>}
            </div>
          </Link>
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
          </div>
        ))}

        <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>クーポン</h2>
        {(!coupons || coupons.length === 0) && (
          <p className="muted">現在利用可能なクーポンはありません。</p>
        )}
        {coupons?.map((c) => (
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
          </div>
        ))}
      </div>
    </div>
  );
}
