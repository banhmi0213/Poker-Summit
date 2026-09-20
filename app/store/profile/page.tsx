import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { updateStoreProfile } from "./actions";
import { createJob, toggleJobStatus, updateJob, deleteJob } from "./jobs-actions";
import { createCoupon, deactivateCoupon, updateCoupon, deleteCoupon } from "./coupons-actions";
import { createEvent, toggleEventStatus, updateEvent, deleteEvent } from "./events-actions";
import {
  JOB_TYPE_OPTIONS,
  STORE_STATUS_LABEL,
  EVENT_CATEGORIES,
  CATEGORY_OPTIONS,
  PREF_OPTIONS,
} from "@/lib/constants";

export default async function StoreProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_user_id", user?.id ?? "")
    .maybeSingle();

  const { data: jobs } = store
    ? await supabase
        .from("jobs")
        .select("*")
        .eq("store_id", store.id)
        .order("posted_at", { ascending: false })
    : { data: null };

  const { data: coupons } = store
    ? await supabase
        .from("coupons")
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const { data: events } = store
    ? await supabase
        .from("events")
        .select("*")
        .eq("store_id", store.id)
        .order("start_at", { ascending: true })
    : { data: null };

  let jobApplicantCounts: Record<string, number> = {};
  let eventParticipantCounts: Record<string, number> = {};
  let favoriteCount = 0;
  let totalViews = 0;
  let totalCouponUses = 0;

  if (store) {
    const jobIds = (jobs ?? []).map((j) => j.id);
    const eventIds = (events ?? []).map((e) => e.id);

    const [{ data: appRows }, { data: partRows }, { count: favCount }, { count: viewCount }] =
      await Promise.all([
        jobIds.length
          ? supabase.from("job_applications").select("job_id").in("job_id", jobIds)
          : Promise.resolve({ data: [] as { job_id: string }[] }),
        eventIds.length
          ? supabase.from("event_participants").select("event_id").in("event_id", eventIds)
          : Promise.resolve({ data: [] as { event_id: string }[] }),
        supabase
          .from("favorite_stores")
          .select("*", { count: "exact", head: true })
          .eq("store_id", store.id),
        supabase
          .from("page_views")
          .select("*", { count: "exact", head: true })
          .eq("store_id", store.id),
      ]);

    appRows?.forEach((r) => {
      jobApplicantCounts[r.job_id] = (jobApplicantCounts[r.job_id] ?? 0) + 1;
    });
    partRows?.forEach((r) => {
      eventParticipantCounts[r.event_id] = (eventParticipantCounts[r.event_id] ?? 0) + 1;
    });
    favoriteCount = favCount ?? 0;
    totalViews = viewCount ?? 0;
    totalCouponUses = (coupons ?? []).reduce((sum, c) => sum + (c.used_count ?? 0), 0);
  }

  const openJobCount = (jobs ?? []).filter((j) => j.status === "open").length;
  const activeCouponCount = (coupons ?? []).filter((c) => c.active).length;

  return (
    <div>
      <header className="header">
        <div className="brand">Poker Summit 店舗管理</div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/store/profile/analytics" className="btn">
            アクセス分析
          </a>
          <a href="/account/password" className="btn">
            パスワード変更
          </a>
          <form action={signOut}>
            <button type="submit" className="btn">
              ログアウト ({user?.email})
            </button>
          </form>
        </div>
      </header>
      <div className="container">
        {!store ? (
          <p className="err">
            このアカウントに紐づく店舗が見つかりません。運営に店舗オーナーとしての登録を依頼してください。
          </p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <h1 style={{ fontSize: 20 }}>{store.name}</h1>
              <span className="badge">
                {STORE_STATUS_LABEL[store.status] ?? store.status}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{totalViews}</div>
                <div className="muted small">累計閲覧数</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{openJobCount}</div>
                <div className="muted small">掲載中の求人（全{jobs?.length ?? 0}件）</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{activeCouponCount}</div>
                <div className="muted small">発行中のクーポン（合計利用{totalCouponUses}回）</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>♥ {favoriteCount}</div>
                <div className="muted small">お気に入り数</div>
              </div>
            </div>

            <div className="card">
              <form action={updateStoreProfile}>
                <input type="hidden" name="storeId" value={store.id} />
                <div className="field">
                  <span className="muted">店舗名 *</span>
                  <input type="text" name="name" required defaultValue={store.name ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">カテゴリ</span>
                  <select name="category" defaultValue={store.category ?? ""}>
                    <option value="">未設定</option>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="muted">都道府県</span>
                  <select name="pref" defaultValue={store.pref ?? ""}>
                    <option value="">未設定</option>
                    {PREF_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="muted">市区町村</span>
                  <input type="text" name="city" defaultValue={store.city ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">住所</span>
                  <input
                    type="text"
                    name="address"
                    defaultValue={store.address ?? ""}
                  />
                </div>
                <div className="field">
                  <span className="muted">電話番号</span>
                  <input type="text" name="tel" defaultValue={store.tel ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">営業時間</span>
                  <input
                    type="text"
                    name="hours"
                    defaultValue={store.hours ?? ""}
                  />
                </div>
                <div className="field">
                  <span className="muted">LINE公式アカウントURL</span>
                  <input type="text" name="lineUrl" placeholder="https://line.me/..." defaultValue={store.line_url ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">店舗紹介文</span>
                  <textarea
                    name="description"
                    rows={5}
                    defaultValue={store.description ?? ""}
                  />
                </div>
                <button type="submit" className="btn primary">
                  保存する
                </button>
              </form>
            </div>

            <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
              求人管理
            </h2>
            <div className="card">
              <form action={createJob}>
                <input type="hidden" name="storeId" value={store.id} />
                <div className="field">
                  <span className="muted">求人タイトル</span>
                  <input type="text" name="title" required />
                </div>
                <div className="field">
                  <span className="muted">雇用形態</span>
                  <select name="jobType" defaultValue="">
                    <option value="">選択してください</option>
                    {JOB_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="muted">給与</span>
                  <input type="text" name="salary" placeholder="例: 時給1300円〜" />
                </div>
                <div className="field">
                  <span className="muted">仕事内容</span>
                  <textarea name="description" rows={3} />
                </div>
                <div className="field">
                  <span className="muted">バナー画像URL</span>
                  <input type="text" name="bannerImageUrl" placeholder="https://..." />
                </div>
                <button type="submit" className="btn primary">
                  求人を掲載する
                </button>
              </form>
            </div>

            {jobs?.map((j) => (
              <div className="card" key={j.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <h3>{j.title}</h3>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span className="badge outline">{j.job_type || "雇用形態未設定"}</span>
                    <span className="badge">
                      {j.status === "open" ? "募集中" : "終了"}
                    </span>
                  </div>
                </div>
                {j.salary && <p className="muted">{j.salary}</p>}
                <p className="muted small" style={{ marginTop: 4 }}>
                  応募数: {jobApplicantCounts[j.id] ?? 0}件
                  {!j.job_type && " ・ ⚠️ 雇用形態が未設定です"}
                </p>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <form
                    action={async () => {
                      "use server";
                      await toggleJobStatus(
                        j.id,
                        store.id,
                        j.status === "open" ? "closed" : "open"
                      );
                    }}
                  >
                    <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                      {j.status === "open" ? "募集を終了する" : "募集を再開する"}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await deleteJob(j.id, store.id);
                    }}
                  >
                    <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                      削除
                    </button>
                  </form>
                </div>
                <details style={{ marginTop: 10 }}>
                  <summary className="muted small" style={{ cursor: "pointer" }}>
                    編集
                  </summary>
                  <form action={updateJob} style={{ marginTop: 10 }}>
                    <input type="hidden" name="storeId" value={store.id} />
                    <input type="hidden" name="jobId" value={j.id} />
                    <div className="field">
                      <span className="muted">求人タイトル</span>
                      <input type="text" name="title" required defaultValue={j.title} />
                    </div>
                    <div className="field">
                      <span className="muted">雇用形態</span>
                      <select name="jobType" defaultValue={j.job_type ?? ""}>
                        <option value="">選択してください</option>
                        {JOB_TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <span className="muted">給与</span>
                      <input type="text" name="salary" defaultValue={j.salary ?? ""} />
                    </div>
                    <div className="field">
                      <span className="muted">仕事内容</span>
                      <textarea name="description" rows={3} defaultValue={j.description ?? ""} />
                    </div>
                    <div className="field">
                      <span className="muted">バナー画像URL</span>
                      <input type="text" name="bannerImageUrl" defaultValue={j.banner_image_url ?? ""} />
                    </div>
                    <button type="submit" className="btn primary" style={{ fontSize: 12.5 }}>
                      更新する
                    </button>
                  </form>
                </details>
              </div>
            ))}

            <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
              クーポン管理
            </h2>
            <div className="card">
              <form action={createCoupon}>
                <input type="hidden" name="storeId" value={store.id} />
                <div className="field">
                  <span className="muted">クーポンタイトル</span>
                  <input type="text" name="title" required />
                </div>
                <div className="field">
                  <span className="muted">割引内容</span>
                  <input type="text" name="discount" placeholder="例: 500円引き" />
                </div>
                <div className="field">
                  <span className="muted">説明</span>
                  <textarea name="description" rows={3} />
                </div>
                <div className="field">
                  <span className="muted">クーポンコード</span>
                  <input type="text" name="code" />
                </div>
                <div className="field">
                  <span className="muted">有効期限</span>
                  <input type="date" name="validUntil" />
                </div>
                <div className="field">
                  <span className="muted">利用上限件数（空欄で無制限）</span>
                  <input type="number" name="usageLimit" min={1} />
                </div>
                <button type="submit" className="btn primary">
                  クーポンを発行する
                </button>
              </form>
            </div>

            {coupons?.map((c) => (
              <div className="card" key={c.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <h3>{c.title}</h3>
                  <span className="badge">{c.active ? "公開中" : "停止中"}</span>
                </div>
                {c.discount && <p className="muted">{c.discount}</p>}
                <p className="muted small" style={{ marginTop: 4 }}>
                  有効期限: {c.valid_until ?? "なし"} ・ 利用 {c.used_count ?? 0}
                  {c.usage_limit != null ? `/${c.usage_limit}` : ""}件
                </p>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {c.active && (
                    <form
                      action={async () => {
                        "use server";
                        await deactivateCoupon(c.id, store.id);
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                        公開を停止する
                      </button>
                    </form>
                  )}
                  <form
                    action={async () => {
                      "use server";
                      await deleteCoupon(c.id, store.id);
                    }}
                  >
                    <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                      削除
                    </button>
                  </form>
                </div>
                <details style={{ marginTop: 10 }}>
                  <summary className="muted small" style={{ cursor: "pointer" }}>
                    編集
                  </summary>
                  <form action={updateCoupon} style={{ marginTop: 10 }}>
                    <input type="hidden" name="storeId" value={store.id} />
                    <input type="hidden" name="couponId" value={c.id} />
                    <div className="field">
                      <span className="muted">クーポンタイトル</span>
                      <input type="text" name="title" required defaultValue={c.title} />
                    </div>
                    <div className="field">
                      <span className="muted">割引内容</span>
                      <input type="text" name="discount" defaultValue={c.discount ?? ""} />
                    </div>
                    <div className="field">
                      <span className="muted">説明</span>
                      <textarea name="description" rows={3} defaultValue={c.description ?? ""} />
                    </div>
                    <div className="field">
                      <span className="muted">クーポンコード</span>
                      <input type="text" name="code" defaultValue={c.code ?? ""} />
                    </div>
                    <div className="field">
                      <span className="muted">有効期限</span>
                      <input type="date" name="validUntil" defaultValue={c.valid_until ?? ""} />
                    </div>
                    <div className="field">
                      <span className="muted">利用上限件数（空欄で無制限）</span>
                      <input type="number" name="usageLimit" min={1} defaultValue={c.usage_limit ?? ""} />
                    </div>
                    <button type="submit" className="btn primary" style={{ fontSize: 12.5 }}>
                      更新する
                    </button>
                  </form>
                </details>
              </div>
            ))}

            <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
              イベント管理
            </h2>
            <div className="card">
              <form action={createEvent}>
                <input type="hidden" name="storeId" value={store.id} />
                <div className="field">
                  <span className="muted">イベント名 *</span>
                  <input type="text" name="title" required />
                </div>
                <div className="field">
                  <span className="muted">開催場所</span>
                  <input type="text" name="location" />
                </div>
                <div className="field">
                  <span className="muted">開始日時</span>
                  <input type="datetime-local" name="startAt" />
                </div>
                <div className="field">
                  <span className="muted">終了日時</span>
                  <input type="datetime-local" name="endAt" />
                </div>
                <div className="field">
                  <span className="muted">イベント詳細</span>
                  <textarea name="description" rows={3} />
                </div>
                <div className="field">
                  <span className="muted">カテゴリ</span>
                  <select name="category" defaultValue="">
                    <option value="">選択してください</option>
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn primary">
                  イベントを掲載する
                </button>
              </form>
            </div>

            {events?.map((ev) => {
              const isPast = ev.start_at ? ev.start_at < new Date().toISOString() : false;
              return (
                <div className="card" key={ev.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <h3>{ev.title}</h3>
                    <div style={{ display: "flex", gap: 6 }}>
                      {ev.category && <span className="badge outline">{ev.category}</span>}
                      {isPast && <span className="badge outline">終了</span>}
                      <span className="badge">
                        {ev.status === "published" ? "公開中" : "非公開"}
                      </span>
                    </div>
                  </div>
                  {ev.location && <p className="muted">{ev.location}</p>}
                  <p className="muted small" style={{ marginTop: 4 }}>
                    参加者数: {eventParticipantCounts[ev.id] ?? 0}人
                  </p>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <form
                      action={async () => {
                        "use server";
                        await toggleEventStatus(
                          ev.id,
                          store.id,
                          ev.status === "published" ? "closed" : "published"
                        );
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                        {ev.status === "published" ? "非公開にする" : "公開する"}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await deleteEvent(ev.id, store.id);
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                        削除
                      </button>
                    </form>
                  </div>
                  <details style={{ marginTop: 10 }}>
                    <summary className="muted small" style={{ cursor: "pointer" }}>
                      編集
                    </summary>
                    <form action={updateEvent} style={{ marginTop: 10 }}>
                      <input type="hidden" name="storeId" value={store.id} />
                      <input type="hidden" name="eventId" value={ev.id} />
                      <div className="field">
                        <span className="muted">イベント名 *</span>
                        <input type="text" name="title" required defaultValue={ev.title} />
                      </div>
                      <div className="field">
                        <span className="muted">開催場所</span>
                        <input type="text" name="location" defaultValue={ev.location ?? ""} />
                      </div>
                      <div className="field">
                        <span className="muted">開始日時</span>
                        <input
                          type="datetime-local"
                          name="startAt"
                          defaultValue={ev.start_at ? ev.start_at.slice(0, 16) : ""}
                        />
                      </div>
                      <div className="field">
                        <span className="muted">終了日時</span>
                        <input
                          type="datetime-local"
                          name="endAt"
                          defaultValue={ev.end_at ? ev.end_at.slice(0, 16) : ""}
                        />
                      </div>
                      <div className="field">
                        <span className="muted">イベント詳細</span>
                        <textarea name="description" rows={3} defaultValue={ev.description ?? ""} />
                      </div>
                      <div className="field">
                        <span className="muted">カテゴリ</span>
                        <select name="category" defaultValue={ev.category ?? ""}>
                          <option value="">選択してください</option>
                          {EVENT_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className="btn primary" style={{ fontSize: 12.5 }}>
                        更新する
                      </button>
                    </form>
                  </details>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
