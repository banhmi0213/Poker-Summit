import { ReadableName } from "@/app/readable-name";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { HoursInput } from "@/app/hours-input";
import { AddressFields } from "./address-fields";
import { updateStoreProfile, updateMyStoreContactEmail, issueMyStoreLineLinkCode } from "./actions";
import { uploadStorePhoto } from "./photos-actions";
import { uploadStoreLogo, deleteStoreLogo } from "./logo-actions";
import { uploadStoreBanner, deleteStoreBanner } from "./banner-actions";
import { PhotoGallery } from "./photo-gallery";
import {
  STORE_STATUS_LABEL,
  CATEGORY_OPTIONS,
  PREF_OPTIONS,
  MAX_STORE_PHOTOS,
} from "@/lib/constants";

// 求人・クーポン・イベント・お知らせ・プランは、それぞれ独立したページへ
// 分離済み(2026/09/30、store-sidebar.tsxを参照)。店舗写真だけは「店舗写真
// を消して店舗管理に画像を入れれるようにして」との指示により、独立ページ
// にはせず、この店舗管理(基本情報)ページの中にとどめている(2026/09/30)。
export default async function StoreProfilePage({
  searchParams,
}: {
  searchParams: { lineCode?: string };
}) {
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
  let unreadApplicationCount = 0;
  let activeContract: { contact_email: string | null } | null = null;

  if (store) {
    const [
      { count: totalJobs },
      { count: openJobs },
      { data: couponsForStats },
      { count: favCount },
      { count: viewCount },
      { data: storeJobIds },
      { data: contractRow },
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
      // 「全店舗有料掲載店にはLINE、メールアドレスの登録をお願いします」の
      // アナウンス判定用(2026/10)。ステータスactiveの契約が無い店舗には
      // そもそもこのアナウンスは出さない(=有料掲載していない店舗は対象外)。
      supabase
        .from("store_contracts")
        .select("contact_email")
        .eq("store_id", store.id)
        .eq("status", "active")
        .maybeSingle(),
    ]);

    totalJobCount = totalJobs ?? 0;
    openJobCount = openJobs ?? 0;
    activeCouponCount = (couponsForStats ?? []).filter((c) => c.active).length;
    totalCouponUses = (couponsForStats ?? []).reduce((sum, c) => sum + (c.used_count ?? 0), 0);
    favoriteCount = favCount ?? 0;
    totalViews = viewCount ?? 0;
    activeContract = contractRow;

    // 「求人のお気に入り数も店舗管理画面でわかるように」との要望により
    // 追加(2026/09/30)。この店舗の全求人を通算したお気に入り数。
    const jobIdList = (storeJobIds ?? []).map((j) => j.id);
    if (jobIdList.length) {
      const [{ count: jobFavCount }, { count: unreadCount }] = await Promise.all([
        supabase
          .from("favorite_jobs")
          .select("*", { count: "exact", head: true })
          .in("job_id", jobIdList),
        // 「求人通知のLINE、メールやけど店管理画面でアナウンス出るように
        // しよか」との指示を受けて追加(2026/10)。viewed_by_store_atが
        // nullの応募=店舗管理画面(求人管理)でまだ確認していない新着応募。
        supabase
          .from("job_applications")
          .select("*", { count: "exact", head: true })
          .in("job_id", jobIdList)
          .is("viewed_by_store_at", null),
      ]);
      jobFavoriteCount = jobFavCount ?? 0;
      unreadApplicationCount = unreadCount ?? 0;
    }
  }

  const needsLineLink = Boolean(store) && !store?.line_user_id;
  const needsContactEmail = Boolean(store) && Boolean(activeContract) && !activeContract?.contact_email;
  const showRegistrationBanner = Boolean(activeContract) && (needsLineLink || needsContactEmail);

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
            <h1 style={{ fontSize: 20 }}><ReadableName name={store.name} /></h1>
            <span className="badge">{STORE_STATUS_LABEL[store.status] ?? store.status}</span>
          </div>

          {/* 新着応募アナウンス(2026/10、「求人通知のLINE、メールやけど
              店管理画面でアナウンス出るようにしよか」との指示を受けて追加)。
              求人管理ページ(/store/profile/jobs)を開くと既読になり消える。 */}
          {unreadApplicationCount > 0 && (
            <div
              className="card"
              style={{ marginBottom: 16, background: "var(--good-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
            >
              <p style={{ fontSize: 13.5, fontWeight: 700 }}>
                📩 新しい応募が{unreadApplicationCount}件届いています。
              </p>
              <a href="/store/profile/jobs" className="btn primary" style={{ fontSize: 12.5 }}>
                求人管理で確認する
              </a>
            </div>
          )}

          {/* LINE・メール登録のお願いアナウンス(2026/10、「全店舗有料掲載店
              にはLINE、メールアドレスの登録をお願いします的な」との指示を
              受けて追加)。ステータスactiveの契約がある店舗(=有料掲載店)
              のみ対象で、LINE未連携・契約メール未登録のいずれかがあれば
              表示する。 */}
          {showRegistrationBanner && (
            <div id="notify-banner" className="card" style={{ marginBottom: 16, scrollMarginTop: 20 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>
                🔔 LINE・メールアドレスのご登録をお願いします
              </p>
              <p className="muted small" style={{ marginBottom: 12 }}>
                求人への応募や運営からのお知らせを、LINE・メールで受け取れるようにするため、未登録の項目のご登録をお願いします。
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {needsContactEmail && (
                  <form action={updateMyStoreContactEmail}>
                    <div className="field">
                      <span className="muted">連絡先メールアドレス(未登録)</span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input
                          type="email"
                          name="contactEmail"
                          required
                          placeholder="例: info@example.com"
                          style={{ flex: "1 1 240px" }}
                        />
                        <button type="submit" className="btn primary" style={{ fontSize: 12.5 }}>
                          登録する
                        </button>
                      </div>
                    </div>
                  </form>
                )}
                {needsLineLink && (
                  <div>
                    <span className="muted" style={{ display: "block", marginBottom: 6 }}>
                      LINE公式アカウント(未連携)
                    </span>
                    {searchParams.lineCode ? (
                      <p style={{ fontSize: 13.5 }}>
                        連携コード: <strong style={{ fontSize: 18, letterSpacing: 2 }}>{searchParams.lineCode}</strong>
                        <br />
                        <span className="muted small">
                          LINE公式アカウントの店舗用メニューから、このコードを入力して連携してください(24時間有効・1回限り)。
                        </span>
                      </p>
                    ) : (
                      <form action={issueMyStoreLineLinkCode}>
                        <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                          LINE連携コードを発行する
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

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
            {/* 店舗カード上部の看板画像(2026/10、「店舗管理画面に画像
                アップロードを２つに」との指示を受けて、ロゴ画像1枚兼用
                だったものを看板とロゴに分離)。店舗カード上部の写真枠
                (約270×142px)にそのまま表示される。 */}
            <div style={{ marginBottom: 20 }}>
              <span className="muted" style={{ display: "block", marginBottom: 8 }}>
                店舗看板（店舗カード上部に表示されます）
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                {store.banner_url ? (
                  <img
                    src={store.banner_url}
                    alt=""
                    style={{
                      width: 160,
                      height: 84,
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "1px solid var(--border-strong)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 160,
                      height: 84,
                      borderRadius: 10,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-strong)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      textAlign: "center",
                      padding: 4,
                    }}
                    className="muted"
                  >
                    未設定
                  </div>
                )}
                <form
                  action={uploadStoreBanner}
                  encType="multipart/form-data"
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <input type="hidden" name="storeId" value={store.id} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input type="file" name="banner" accept="image/*" required />
                    <button type="submit" className="btn">
                      {store.banner_url ? "変更する" : "アップロードする"}
                    </button>
                  </div>
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    推奨サイズ: 横900×縦470px程度の横長画像（ファイルサイズは8MBまで）。カード表示時にこの比率からはみ出た部分は自動でトリミングされます。
                  </span>
                </form>
                {store.banner_url && (
                  <form
                    action={async () => {
                      "use server";
                      await deleteStoreBanner(store.id);
                    }}
                  >
                    <button type="submit" className="btn">
                      削除
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* 左下の小さいロゴ枠(約58×58px)用の画像。店舗カード看板の
                左下に重ねて表示される(従来からのlogo_url/logo-actions.ts
                をそのまま使用)。 */}
            <div style={{ marginBottom: 20 }}>
              <span className="muted" style={{ display: "block", marginBottom: 8 }}>
                ロゴ画像（店舗カード左下の丸枠に表示されます）
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                {store.logo_url ? (
                  <img
                    src={store.logo_url}
                    alt=""
                    style={{
                      width: 88,
                      height: 88,
                      objectFit: "contain",
                      borderRadius: 10,
                      border: "1px solid var(--border-strong)",
                      background: "var(--surface-2)",
                      padding: 6,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 10,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-strong)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      textAlign: "center",
                      padding: 4,
                    }}
                    className="muted"
                  >
                    未設定
                  </div>
                )}
                <form
                  action={uploadStoreLogo}
                  encType="multipart/form-data"
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <input type="hidden" name="storeId" value={store.id} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input type="file" name="logo" accept="image/*" required />
                    <button type="submit" className="btn">
                      {store.logo_url ? "変更する" : "アップロードする"}
                    </button>
                  </div>
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    推奨サイズ: 正方形（例: 300×300px程度、ファイルサイズは8MBまで）。
                  </span>
                </form>
                {store.logo_url && (
                  <form
                    action={async () => {
                      "use server";
                      await deleteStoreLogo(store.id);
                    }}
                  >
                    <button type="submit" className="btn">
                      削除
                    </button>
                  </form>
                )}
              </div>
            </div>
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
                <span className="muted">最寄り駅</span>
                <input
                  type="text"
                  name="nearestStation"
                  placeholder="例: 梅田駅 徒歩5分"
                  defaultValue={store.nearest_station ?? ""}
                />
              </div>
              <div className="field">
                <span className="muted">電話番号</span>
                <input type="text" name="tel" defaultValue={store.tel ?? ""} />
              </div>
              <div className="field">
                <span className="muted">営業時間</span>
                <HoursInput initialValue={store.hours} />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 12,
                }}
              >
                <div className="field">
                  <span className="muted">メールアドレス</span>
                  <input type="email" name="email" placeholder="例: info@example.com" defaultValue={store.email ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">LINE公式アカウントURL</span>
                  <input type="text" name="lineUrl" placeholder="https://line.me/..." defaultValue={store.line_url ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">Xアカウント</span>
                  <input type="text" name="xUrl" placeholder="https://x.com/..." defaultValue={store.x_url ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">Instagram</span>
                  <input type="text" name="instagramUrl" placeholder="https://instagram.com/..." defaultValue={store.instagram_url ?? ""} />
                </div>
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

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginTop: 28,
              marginBottom: 12,
            }}
          >
            <h2 id="photos" style={{ fontSize: 18, scrollMarginTop: 20 }}>
              店舗写真ギャラリー
            </h2>
            <span className="muted small">
              {(photos?.length ?? 0)}/{MAX_STORE_PHOTOS}枚
            </span>
          </div>
          <div className="card">
            {(photos?.length ?? 0) >= MAX_STORE_PHOTOS ? (
              <p className="muted small">
                写真は上限の{MAX_STORE_PHOTOS}枚に達しています。追加するには、ギャラリーから不要な写真を削除してください。
              </p>
            ) : (
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
            )}
            {photos && photos.length > 0 && (
              <PhotoGallery photos={photos} storeId={store.id} />
            )}
          </div>
        </>
      )}
    </>
  );
}
