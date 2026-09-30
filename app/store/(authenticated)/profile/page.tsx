import { createClient } from "@/lib/supabase/server";
import { HoursInput } from "@/app/hours-input";
import { updateStoreProfile } from "./actions";
import { createJob, toggleJobStatus, updateJob, deleteJob } from "./jobs-actions";
import { createCoupon, deactivateCoupon, updateCoupon, deleteCoupon } from "./coupons-actions";
import { createEvent, toggleEventStatus, updateEvent, deleteEvent } from "./events-actions";
import { createNotice, updateNotice, toggleNoticeStatus, deleteNotice } from "./notices-actions";
import { uploadStorePhoto, deleteStorePhoto } from "./photos-actions";
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

  const [
    { data: jobs },
    { data: coupons },
    { data: events },
    { data: pendingRequests },
    { data: notices },
    { data: photos },
  ] = store
    ? await Promise.all([
        supabase
          .from("jobs")
          .select("*")
          .eq("store_id", store.id)
          .order("posted_at", { ascending: false }),
        supabase
          .from("coupons")
          .select("*")
          .eq("store_id", store.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("events")
          .select("*")
          .eq("store_id", store.id)
          .order("start_at", { ascending: true }),
        supabase
          .from("store_change_requests")
          .select("id, field, proposed_value, requested_at")
          .eq("store_id", store.id)
          .eq("status", "pending"),
        supabase
          .from("store_notices")
          .select("*")
          .eq("store_id", store.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("store_photos")
          .select("*")
          .eq("store_id", store.id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }, { data: null }, { data: null }];

  // 店名・住所は運営承認待ちのあいだ、フォームを読み取り専用にして二重申請
  // を防ぐ(store/profile/actions.ts の申請ロジックと対になる表示)。
  const pendingNameRequest = pendingRequests?.find((r) => r.field === "name");
  const pendingAddressRequest = pendingRequests?.find((r) => r.field === "address");

  let jobApplicantCounts: Record<string, number> = {};
  let jobFavoriteCounts: Record<string, number> = {};
  let eventParticipantCounts: Record<string, number> = {};
  let favoriteCount = 0;
  let totalViews = 0;
  let totalCouponUses = 0;

  if (store) {
    const jobIds = (jobs ?? []).map((j) => j.id);
    const eventIds = (events ?? []).map((e) => e.id);

    const [
      { data: appRows },
      { data: jobFavRows },
      { data: partRows },
      { count: favCount },
      { count: viewCount },
    ] = await Promise.all([
      jobIds.length
        ? supabase.from("job_applications").select("job_id").in("job_id", jobIds)
        : Promise.resolve({ data: [] as { job_id: string }[] }),
      jobIds.length
        ? supabase.from("favorite_jobs").select("job_id").in("job_id", jobIds)
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
    jobFavRows?.forEach((r) => {
      jobFavoriteCounts[r.job_id] = (jobFavoriteCounts[r.job_id] ?? 0) + 1;
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
    <>
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
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={store.name ?? ""}
                    readOnly={Boolean(pendingNameRequest)}
                    style={pendingNameRequest ? { background: "var(--surface-2)" } : undefined}
                  />
                  {pendingNameRequest ? (
                    <span className="muted" style={{ fontSize: 11.5 }}>
                      ⏳「{(pendingNameRequest.proposed_value as { name?: string })?.name}」への変更は運営の承認待ちです。承認されるまでこの欄は編集できません。
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 11.5 }}>
                      店舗名の変更は検索・地図に影響するため、保存後は運営の承認を経てから反映されます。
                    </span>
                  )}
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
                  {pendingAddressRequest && (
                    // A disabled <select> is excluded from FormData entirely,
                    // so carry the unchanged current value through a hidden
                    // field instead — otherwise the action would see pref
                    // arrive as "" and mistake that for an intentional clear.
                    <input type="hidden" name="pref" value={store.pref ?? ""} />
                  )}
                  <select
                    name={pendingAddressRequest ? undefined : "pref"}
                    defaultValue={store.pref ?? ""}
                    disabled={Boolean(pendingAddressRequest)}
                  >
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
                  <input
                    type="text"
                    name="city"
                    defaultValue={store.city ?? ""}
                    readOnly={Boolean(pendingAddressRequest)}
                    style={pendingAddressRequest ? { background: "var(--surface-2)" } : undefined}
                  />
                </div>
                <div className="field">
                  <span className="muted">住所</span>
                  <input
                    type="text"
                    name="address"
                    defaultValue={store.address ?? ""}
                    readOnly={Boolean(pendingAddressRequest)}
                    style={pendingAddressRequest ? { background: "var(--surface-2)" } : undefined}
                  />
                  {pendingAddressRequest ? (
                    <span className="muted" style={{ fontSize: 11.5 }}>
                      ⏳ 新しい住所への変更は運営の承認待ちです。承認されるまでこれらの欄は編集できません。
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 11.5 }}>
                      住所の変更は地図・現在地検索・ナビに影響するため、保存後は運営の承認を経てから反映されます(反映時に座標も自動取得されます)。
                    </span>
                  )}
                </div>
                <div className="field">
                  <span className="muted">電話番号</span>
                  <input type="text" name="tel" defaultValue={store.tel ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">営業時間</span>
                  <HoursInput initialValue={store.hours} />
                </div>
                <div className="field">
                  <span className="muted">LINE公式アカウントURL</span>
                  <input type="text" name="lineUrl" placeholder="https://line.me/..." defaultValue={store.line_url ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">検索キーワード（検索用・任意）</span>
                  <input
                    type="text"
                    name="areaKeywords"
                    placeholder="例: ミナミ アメ村 心斎橋 駅近 駐車場あり パーキングあり"
                    defaultValue={store.area_keywords ?? ""}
                  />
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    通称・繁華街名や「駅近」「駐車場あり」などの特徴をスペース区切りで入力すると、トップ画面の検索でヒットしやすくなります。
                  </span>
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
                  応募数: {jobApplicantCounts[j.id] ?? 0}件 ・ お気に入り数: {jobFavoriteCounts[j.id] ?? 0}件
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

            <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
              お知らせ管理
            </h2>
            <div className="card">
              <form action={createNotice}>
                <input type="hidden" name="storeId" value={store.id} />
                <div className="field">
                  <span className="muted">タイトル *</span>
                  <input type="text" name="title" required />
                </div>
                <div className="field">
                  <span className="muted">本文</span>
                  <textarea name="body" rows={3} />
                </div>
                <button type="submit" className="btn primary">
                  お知らせを掲載する
                </button>
              </form>
            </div>

            {notices?.map((n) => (
              <div className="card" key={n.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <h3>{n.title}</h3>
                  <span className="badge">{n.status === "published" ? "公開中" : "非公開"}</span>
                </div>
                {n.body && <p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>{n.body}</p>}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <form
                    action={async () => {
                      "use server";
                      await toggleNoticeStatus(n.id, store.id, n.status === "published" ? "hidden" : "published");
                    }}
                  >
                    <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                      {n.status === "published" ? "非公開にする" : "公開する"}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await deleteNotice(n.id, store.id);
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
                  <form action={updateNotice} style={{ marginTop: 10 }}>
                    <input type="hidden" name="storeId" value={store.id} />
                    <input type="hidden" name="noticeId" value={n.id} />
                    <div className="field">
                      <span className="muted">タイトル *</span>
                      <input type="text" name="title" required defaultValue={n.title} />
                    </div>
                    <div className="field">
                      <span className="muted">本文</span>
                      <textarea name="body" rows={3} defaultValue={n.body ?? ""} />
                    </div>
                    <button type="submit" className="btn primary" style={{ fontSize: 12.5 }}>
                      更新する
                    </button>
                  </form>
                </details>
              </div>
            ))}

            <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
              店舗写真
            </h2>
            <div className="card">
              <form action={uploadStorePhoto} encType="multipart/form-data">
                <input type="hidden" name="storeId" value={store.id} />
                <div className="field">
                  <span className="muted">写真を追加（スマホの写真ライブラリ・カメラから選択できます）</span>
                  <input type="file" name="photo" accept="image/*" capture="environment" required />
                </div>
                <button type="submit" className="btn primary">
                  アップロードする
                </button>
              </form>
              {photos && photos.length > 0 && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  {photos.map((p) => (
                    <div key={p.id} style={{ position: "relative" }}>
                      <img
                        src={p.url}
                        alt=""
                        style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8 }}
                      />
                      <form
                        action={async () => {
                          "use server";
                          await deleteStorePhoto(p.id, store.id);
                        }}
                        style={{ marginTop: 4 }}
                      >
                        <button type="submit" className="btn" style={{ fontSize: 11.5, padding: "4px 8px" }}>
                          削除
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </>
      )}
    </>
  );
}