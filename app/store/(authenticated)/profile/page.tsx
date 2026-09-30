import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { HoursInput } from "@/app/hours-input";
import { AddressFields } from "./address-fields";
import { updateStoreProfile } from "./actions";
import { uploadStorePhoto, deleteStorePhoto } from "./photos-actions";
import {
  STORE_STATUS_LABEL,
  CATEGORY_OPTIONS,
  PREF_OPTIONS,
} from "@/lib/constants";

// 求人・クーポン・イベント・お知らせ・プランは、それぞれ独立したページへ
// 分離済み(2026/09/30、store-sidebar.tsxを参照)。店舗写真だけは「店舗写真
// を消して店舗管理に画像を入れれるようにして」との指示により、独立ページ
// にはせず、この店舗管理(基本情報)ページの中にとどめている(2026/09/30)。
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

  const [{ data: pendingRequests }, { data: photos }] = store
    ? await Promise.all([
        supabase
          .from("store_change_requests")
          .select("id, field, proposed_value, requested_at")
          .eq("store_id", store.id)
          .eq("status", "pending"),
        supabase
          .from("store_photos")
          .select("*")
          .eq("store_id", store.id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ])
    : [{ data: null }, { data: null }];

  // 店名・住所は運営承認待ちのあいだ、フォームを読み取り専用にして二重申請
  // を防ぐ(store/profile/actions.ts の申請ロジックと対になる表示)。
  const pendingNameRequest = pendingRequests?.find((r) => r.field === "name");
  const pendingAddressRequest = pendingRequests?.find((r) => r.field === "address");

  let openJobCount = 0;
  let totalJobCount = 0;
  let activeCouponCount = 0;
  let totalCouponUses = 0;
  let favoriteCount = 0;
  let totalViews = 0;
  let jobFavoriteCount = 0;

  if (store) {
    const [
      { count: totalJobs },
      { count: openJobs },
      { data: couponsForStats },
      { count: favCount },
      { count: viewCount },
      { data: storeJobIds },
    ] = await Promise.all([
      supabase.from("jobs").select("*", { count: "exact", head: true }).eq("store_id", store.id),
      supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("store_id", store.id)
        .eq("status", "open"),
      supabase.from("coupons").select("active, used_count").eq("store_id", store.id),
      supabase
        .from("favorite_stores")
        .select("*", { count: "exact", head: true })
        .eq("store_id", store.id),
      supabase
        .from("page_views")
        .select("*", { count: "exact", head: true })
        .eq("store_id", store.id),
      supabase.from("jobs").select("id").eq("store_id", store.id),
    ]);

    totalJobCount = totalJobs ?? 0;
    openJobCount = openJobs ?? 0;
    activeCouponCount = (couponsForStats ?? []).filter((c) => c.active).length;
    totalCouponUses = (couponsForStats ?? []).reduce((sum, c) => sum + (c.used_count ?? 0), 0);
    favoriteCount = favCount ?? 0;
    totalViews = viewCount ?? 0;

    // 「求人のお気に入り数も店舗管理画面でわかるように」との要望により
    // 追加(2026/09/30)。この店舗の全求人を通算したお気に入り数。
    const jobIdList = (storeJobIds ?? []).map((j) => j.id);
    if (jobIdList.length) {
      const { count: jobFavCount } = await supabase
        .from("favorite_jobs")
        .select("*", { count: "exact", head: true })
        .in("job_id", jobIdList);
      jobFavoriteCount = jobFavCount ?? 0;
    }
  }

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
            <span className="badge">{STORE_STATUS_LABEL[store.status] ?? store.status}</span>
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
              <div className="muted small">掲載中の求人（全{totalJobCount}件）</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{activeCouponCount}</div>
              <div className="muted small">発行中のクーポン（合計利用{totalCouponUses}回）</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>♥ {favoriteCount}</div>
              <div className="muted small">お気に入り数</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>★ {jobFavoriteCount}</div>
              <div className="muted small">求人のお気に入り数（全求人合計）</div>
            </div>
          </div>

          <div className="card" id="profile-info" style={{ scrollMarginTop: 20 }}>
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
              <AddressFields
                prefOptions={PREF_OPTIONS}
                initialPref={store.pref ?? ""}
                initialCity={store.city ?? ""}
                initialAddress={store.address ?? ""}
                disabled={Boolean(pendingAddressRequest)}
              />
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
                <textarea name="description" rows={5} defaultValue={store.description ?? ""} />
              </div>
              <button type="submit" className="btn primary">
                保存する
              </button>
            </form>
          </div>

          <h2 id="photos" style={{ fontSize: 18, marginTop: 28, marginBottom: 12, scrollMarginTop: 20 }}>
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
