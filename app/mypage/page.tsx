import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import {
  toggleFavoriteStore,
  toggleFavoriteJob,
  applyToJob,
  leaveEvent,
} from "@/app/member-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP");
}

function statusBadge(status: string) {
  if (status === "open") return <span className="badge good">● 公開中</span>;
  if (status === "closed") return <span className="badge outline">停止中</span>;
  return <span className="badge outline">{status}</span>;
}

export default async function MyPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/mypage");
  }

  const [
    { data: favStoreRows },
    { data: favJobRows },
    { data: applications },
    { data: participations },
    { data: couponUseRows },
    { data: allActiveCoupons },
    { data: myPosts },
  ] = await Promise.all([
    supabase.from("favorite_stores").select("stores(id, name, category, pref, city)").eq("user_id", user.id),
    supabase
      .from("favorite_jobs")
      .select("jobs(id, title, status, store_id, stores(name, pref))")
      .eq("user_id", user.id),
    supabase
      .from("job_applications")
      .select("applied_at, jobs(id, title, status, store_id, stores(name, pref))")
      .eq("user_id", user.id)
      .order("applied_at", { ascending: false }),
    supabase
      .from("event_participants")
      .select("event_id, events(id, title, location, start_at, store_id, stores(pref))")
      .eq("user_id", user.id),
    supabase
      .from("coupon_uses")
      .select("coupon_id, used_at")
      .eq("user_id", user.id),
    supabase
      .from("coupons")
      .select("id, title, valid_until, usage_limit, used_count, store_id, stores(name)")
      .eq("active", true),
    supabase
      .from("board_posts")
      .select("id, title, created_at")
      .eq("author_user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const appliedJobIds = new Set((applications ?? []).map((a: any) => a.jobs?.id));
  const usedCouponIds = new Set((couponUseRows ?? []).map((r: any) => r.coupon_id));
  const unusedCoupons = (allActiveCoupons ?? []).filter(
    (c: any) => !usedCouponIds.has(c.id) && (c.usage_limit == null || (c.used_count ?? 0) < c.usage_limit)
  );
  const usedCoupons = (allActiveCoupons ?? []).filter((c: any) => usedCouponIds.has(c.id));

  const favStores = (favStoreRows ?? []).map((r: any) => r.stores).filter(Boolean);
  const favJobs = (favJobRows ?? []).map((r: any) => r.jobs).filter(Boolean);
  const rsvpEvents = (participations ?? [])
    .map((r: any) => r.events)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.start_at ?? "").localeCompare(b.start_at ?? ""));

  const tab = searchParams.tab || "favorites";
  const name = (user.user_metadata as any)?.display_name || "会員";
  const pref = (user.user_metadata as any)?.pref || "";
  const joinedAt = user.created_at ? formatDate(user.created_at) : "";

  const tabs: { key: string; label: string }[] = [
    { key: "favorites", label: `♥ お気に入り店舗(${favStores.length})` },
    { key: "favJobs", label: `☆ お気に入り求人(${favJobs.length})` },
    { key: "jobs", label: `💼 応募した求人(${applications?.length ?? 0})` },
    { key: "coupons", label: `🎟️ クーポン` },
    { key: "events", label: `🏆 参加予定イベント(${rsvpEvents.length})` },
    { key: "posts", label: `💬 投稿(${myPosts?.length ?? 0})` },
  ];

  return (
    <div>
      <PortalHeader userEmail={user.email} />
      <div className="container">
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>マイページ</h1>

        <div className="card" style={{ maxWidth: 680, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 19 }}>{name}</div>
              <div className="muted small">
                📍 {pref || "未設定"} {joinedAt && `・ ${joinedAt}に登録`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/account/password" className="btn" style={{ fontSize: 12.5 }}>
                パスワード変更
              </Link>
              <form action={signOut}>
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  ログアウト
                </button>
              </form>
            </div>
          </div>
          <hr style={{ border: "none", borderTop: "1px solid var(--grid)" }} />
          <div className="muted small" style={{ marginTop: 10 }}>
            ✉️ {user.email}
          </div>
        </div>

        <div className="chip-row" style={{ maxWidth: 680, marginBottom: 20 }}>
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/mypage?tab=${t.key}`}
              className={`chip ${tab === t.key ? "active" : ""}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 10 }}>
          {tab === "favorites" &&
            (favStores.length === 0 ? (
              <p className="muted small">
                まだお気に入り店舗がありません。店舗ページの「☆ お気に入りに追加」から登録できます。
              </p>
            ) : (
              favStores.map((s: any) => (
                <div className="card" key={s.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Link href={`/stores/${s.id}`} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{s.name}</div>
                    <div className="muted small">
                      📍 {s.pref}
                      {s.city}
                    </div>
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await toggleFavoriteStore(s.id, "/mypage");
                    }}
                  >
                    <button type="submit" className="btn" style={{ fontSize: 12 }}>
                      解除
                    </button>
                  </form>
                </div>
              ))
            ))}

          {tab === "favJobs" &&
            (favJobs.length === 0 ? (
              <p className="muted small">
                まだお気に入り求人がありません。求人一覧や求人詳細ページの「☆」ボタンから登録すると、あとでまとめて応募できます。
              </p>
            ) : (
              favJobs.map((j: any) => (
                <div className="card" key={j.id} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <Link href={`/jobs/${j.id}`} style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 800 }}>{j.title}</div>
                    <div className="muted small">
                      {j.stores?.name} ・ {j.stores?.pref}
                    </div>
                  </Link>
                  <div style={{ display: "flex", gap: 8 }}>
                    {appliedJobIds.has(j.id) ? (
                      <span className="badge good">✓ 応募済み</span>
                    ) : j.status === "open" ? (
                      <form
                        action={async () => {
                          "use server";
                          await applyToJob(j.id, "/mypage?tab=favJobs");
                        }}
                      >
                        <button type="submit" className="btn primary" style={{ fontSize: 12 }}>
                          応募する
                        </button>
                      </form>
                    ) : (
                      <span className="badge outline">募集終了</span>
                    )}
                    <form
                      action={async () => {
                        "use server";
                        await toggleFavoriteJob(j.id, "/mypage?tab=favJobs");
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12 }}>
                        解除
                      </button>
                    </form>
                  </div>
                </div>
              ))
            ))}

          {tab === "jobs" &&
            ((applications?.length ?? 0) === 0 ? (
              <p className="muted small">まだ応募した求人がありません。</p>
            ) : (
              applications?.map((row: any) => {
                const j = row.jobs;
                if (!j) return null;
                return (
                  <Link href={`/jobs/${j.id}`} key={j.id}>
                    <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>{j.title}</div>
                        <div className="muted small">
                          {j.stores?.name} ・ {j.stores?.pref}
                        </div>
                      </div>
                      {statusBadge(j.status)}
                    </div>
                  </Link>
                );
              })
            ))}

          {tab === "coupons" && (
            <>
              <h3 style={{ fontSize: 14.5 }}>未使用 ({unusedCoupons.length})</h3>
              {unusedCoupons.length === 0 ? (
                <p className="muted small" style={{ marginBottom: 22 }}>
                  未使用のクーポンはありません。
                </p>
              ) : (
                unusedCoupons.map((c: any) => (
                  <div className="card" key={c.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <Link href={`/coupons/${c.id}`} style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{c.title}</div>
                      <div className="muted small">
                        {c.stores?.name} ・ 期限 {c.valid_until ?? "なし"}
                      </div>
                    </Link>
                    <Link href={`/coupons/${c.id}`} className="btn primary" style={{ fontSize: 12 }}>
                      使う
                    </Link>
                  </div>
                ))
              )}
              <h3 style={{ fontSize: 14.5, marginTop: 16 }}>使用済み ({usedCoupons.length})</h3>
              {usedCoupons.length === 0 ? (
                <p className="muted small">使用済みのクーポンはありません。</p>
              ) : (
                usedCoupons.map((c: any) => (
                  <div className="card" key={c.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <Link href={`/coupons/${c.id}`} style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{c.title}</div>
                      <div className="muted small">
                        {c.stores?.name} ・ 期限 {c.valid_until ?? "なし"}
                      </div>
                    </Link>
                    <span className="badge good">✓ 使用済み</span>
                  </div>
                ))
              )}
            </>
          )}

          {tab === "events" &&
            (rsvpEvents.length === 0 ? (
              <p className="muted small">
                参加予定のイベントはありません。イベント詳細ページの「📅 参加予定に追加」から登録できます。
              </p>
            ) : (
              rsvpEvents.map((ev: any) => (
                <div className="card" key={ev.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Link href={`/events/${ev.id}`} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{ev.title}</div>
                    <div className="muted small">
                      {ev.location} ・ {ev.stores?.pref}
                    </div>
                  </Link>
                  <span className="badge accent">{formatDate(ev.start_at)}</span>
                  <form
                    action={async () => {
                      "use server";
                      await leaveEvent(ev.id, "/mypage?tab=events");
                    }}
                  >
                    <button type="submit" className="btn" style={{ fontSize: 12 }}>
                      参加取消
                    </button>
                  </form>
                </div>
              ))
            ))}

          {tab === "posts" && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <Link href="/board" className="btn" style={{ fontSize: 12.5 }}>
                  ✏️ 新しく投稿する
                </Link>
              </div>
              {(myPosts?.length ?? 0) === 0 ? (
                <p className="muted small">まだ投稿がありません。サミットで最初の投稿をしてみましょう。</p>
              ) : (
                myPosts?.map((p) => (
                  <Link href={`/board/${p.id}`} key={p.id}>
                    <div className="card">
                      <div style={{ fontWeight: 700 }}>{p.title}</div>
                      <div className="muted small">{formatDate(p.created_at)}</div>
                    </div>
                  </Link>
                ))
              )}
            </>
          )}
        </div>
      </div>
      <PortalFooter />
      <BottomTabs active="mypage" />
    </div>
  );
}
