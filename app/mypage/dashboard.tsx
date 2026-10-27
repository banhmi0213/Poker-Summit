import { BoardNotificationLink } from "@/app/board/notification-controls";
import { BoardPanel } from "./board-panel";
import { ReadableName } from "@/app/readable-name";
import { OfficialBadge } from "@/app/member-role-badge";
import { couponExpiryLabel, isCouponExpired } from "@/lib/coupon-expiry";
import {NotificationBadge} from "@/app/matching/chat/notification-badge";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import {
  toggleFavoriteStore,
  toggleFavoriteJob,
  leaveEvent,
} from "@/app/member-actions";
import { setFavoriteCoupon } from "@/app/coupons/favorite-actions";
import { uploadAvatar, removeAvatar } from "@/app/mypage/actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { AccountIcon } from "./account-icon";
import { ProfileEditor } from "./profile-editor";
import styles from "./profile-layout.module.css";
import { Avatar } from "@/app/avatar";
import { AcademyBadge } from "@/app/learn/academy-badge";
import { PREF_OPTIONS } from "@/lib/constants";
import { saveJobAlertPreferences } from "./job-alert-actions";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP");
}

function statusBadge(status: string) {
  if (status === "open") return <span className="badge good">● 公開中</span>;
  if (status === "closed") return <span className="badge outline">停止中</span>;
  return <span className="badge outline">{status}</span>;
}

export async function MyPageContent({
  searchParams,
  profileEdit = false,
  dealerRegistration = false,
}: {
  searchParams: { tab?: string; boardPage?: string; error?: string; done?: string };
  profileEdit?: boolean;
  dealerRegistration?: boolean;
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
    { data: favCouponRows, error: favCouponError },
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
    supabase.from("favorite_coupons").select("coupons(id, title, discount, valid_until, expires_at, active, stores(name))").eq("user_id", user.id).order("created_at", { ascending: false }),
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
      .select("id, title, valid_until, expires_at, usage_limit, used_count, store_id, stores(name)")
      .eq("active", true),
    supabase
      .from("board_posts")
      .select("id, title, created_at")
      .eq("author_user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  // アイコン画像(2026/10、「会員マイページにアイコンを設定できるように
  // して」との指示)。display_name/prefと違いuser_metadataではなく
  // profilesテーブルに持たせている(他人の投稿者アイコンを一覧でまとめて
  // 引けるようにするため。詳しくはapp/avatar.tsxのコメント参照)。
  const { data: dealerProfile } = await supabase.from("dealer_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  // m HOLD'EM ID(一度登録したら本人は変更できない。member_m_holdem_ids)
  const { data: mHoldemRow } = await supabase.from("member_m_holdem_ids").select("m_holdem_id").eq("user_id", user.id).maybeSingle();
  const mHoldemId = (mHoldemRow?.m_holdem_id as string | undefined) ?? "";
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("avatar_url, pref_public, role, bio, email_public")
    .eq("user_id", user.id)
    .maybeSingle();
  const {data:graduation}=await supabase.from("academy_graduation").select("best_score").eq("user_id",user.id).maybeSingle();
  const graduationScore=graduation?.best_score ?? null;
  const avatarUrl = myProfile?.avatar_url ?? null;
  // 都道府県の公開設定(2026/10追加)。profiles未保存ならsignup時の
  // user_metadataの値、それも無ければ公開扱い。
  const prefPublic =
    typeof myProfile?.pref_public === "boolean"
      ? myProfile.pref_public
      : (user.user_metadata as any)?.pref_public !== false;

  const appliedJobIds = new Set((applications ?? []).map((a: any) => a.jobs?.id));
  const usedCouponIds = new Set((couponUseRows ?? []).map((r: any) => r.coupon_id));
  const unusedCoupons = (allActiveCoupons ?? []).filter(
    (c: any) => !usedCouponIds.has(c.id) && !isCouponExpired(c) && (c.usage_limit == null || (c.used_count ?? 0) < c.usage_limit)
  );
  const usedCoupons = (allActiveCoupons ?? []).filter((c: any) => usedCouponIds.has(c.id));

  if (favCouponError) throw new Error("お気に入りクーポンを読み込めませんでした。");
  const favCoupons = (favCouponRows ?? []).map((r: any) => r.coupons).filter(Boolean);

  const favStores = (favStoreRows ?? []).map((r: any) => r.stores).filter(Boolean);
  const favJobs = (favJobRows ?? []).map((r: any) => r.jobs).filter(Boolean);
  const rsvpEvents = (participations ?? [])
    .map((r: any) => r.events)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.start_at ?? "").localeCompare(b.start_at ?? ""));

  // 運営からのいちばん新しいお知らせ(30日以内。会員が気付けるようマイページの上に出す、2026/10/20)
  const { data: latestNotice } = await supabase
    .from("site_notices")
    .select("title, created_at")
    .eq("published", true)
    .gte("created_at", new Date(Date.now() - 30 * 86400 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 「運営」バッジのアカウントか(マイページにもバッジを出す、2026/10/20)
  const { data: officialRows } = await supabase.rpc("official_board_user_ids", { p_ids: [user.id] });
  const isOfficial = ((officialRows ?? []) as unknown[]).length > 0;

  const tab = searchParams.tab || "favorites";
  const {data:alertPrefs}=await supabase.from("job_alert_preferences").select("enabled,pref,experience_level,subscribed_at").eq("user_id",user.id).maybeSingle();
  let matchingJobs: any[]=[];
  if(alertPrefs?.enabled) {
    let alertQuery=supabase.from("jobs").select("id,title,experience_level,posted_at,application_deadline,stores!inner(name,pref,status)").eq("status","open").gte("posted_at",alertPrefs.subscribed_at).or(`application_deadline.is.null,application_deadline.gte.${new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})}`).order("posted_at",{ascending:false}).limit(100);
    if(alertPrefs.pref) alertQuery=alertQuery.eq("stores.pref",alertPrefs.pref);
    const {data:alertRows}=await alertQuery;
    matchingJobs=(alertRows||[]).filter((j:any)=>["approved","listed"].includes(j.stores?.status)
      && (!j.application_deadline || j.application_deadline>=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"}))
      && (alertPrefs.experience_level==="any" || !j.experience_level || j.experience_level==="any" || j.experience_level===alertPrefs.experience_level));
  }
  const name = (user.user_metadata as any)?.display_name || "会員";
  const pref = (user.user_metadata as any)?.pref || "";
  // 表示用の登録日を運営が指定している場合はそちら(member_joined_overrides、2026/10/20)
  const { data: joinedOverride } = await supabase.from("member_joined_overrides").select("joined_on").eq("user_id", user.id).maybeSingle();
  const joinedAt = joinedOverride?.joined_on
    ? (() => { const [y, m, d] = String(joinedOverride.joined_on).split("-").map(Number); return `${y}/${m}/${d}`; })()
    : user.created_at
      ? formatDate(user.created_at)
      : "";

  const [{ count: boardFollowCount }, { count: boardUnreadCount }] = await Promise.all([
    supabase.from("board_thread_preferences").select("post_id,board_posts!inner(status)", { count:"exact",head:true }).eq("user_id",user.id).eq("following",true).eq("board_posts.status","visible"),
    supabase.from("board_notifications").select("id", { count:"exact",head:true }).eq("user_id",user.id).is("read_at",null),
  ]);
  const {count:boardNotificationCount}=await supabase.from("board_notifications").select("id",{count:"exact",head:true}).eq("user_id",user.id);
  const {count:ownPostUnread}=myPosts?.length ? await supabase.from("board_notifications").select("id",{count:"exact",head:true}).eq("user_id",user.id).is("read_at",null).in("post_id",myPosts.map(p=>p.id)) : {count:0};
  const tabs = [
    { key:"favorites",label:"お気に入り店舗",icon:"♥",detail:`${favStores.length} 件`,unread:0 },
    { key:"jobAlerts",label:"新着求人通知",icon:"🔔",detail:`${matchingJobs.length} 件`,unread:0 },
    { key:"favJobs",label:"お気に入り求人",icon:"★",detail:`${favJobs.length} 件`,unread:0 },
    { key:"coupons",label:"クーポン",icon:"▤",detail:`${favCoupons.length} 件`,unread:0 },
    { key:"events",label:"参加予定イベント",icon:"♛",detail:`${rsvpEvents.length} 件`,unread:0 },
    { key:"boardFollows",label:"フォロー中",icon:"☆",detail:`${boardFollowCount ?? 0} 件`,unread:0 },
    { key:"boardNotifications",label:"サミット通知",icon:"🔔",detail:`${boardNotificationCount ?? 0} 件・未読 ${boardUnreadCount ?? 0} 件`,unread:boardUnreadCount ?? 0 },
    { key:"posts",label:"投稿",icon:"💬",detail:`未読通知数 ${ownPostUnread ?? 0} 件`,unread:ownPostUnread ?? 0 },
  ];

  return (
    <div>
      <PortalHeader userEmail={user.email} />
      <div className={`container ${styles.page}`}>
        <div className={styles.pageHeading}>
          <h1 style={{ fontSize: 22, margin: 0 }}>マイページ</h1><Link href="/mypage/poker" className="btn">オンラインポーカー：大会履歴・残高・順位</Link>
          {dealerProfile && (
            <Link href="/spot-jobs" className={styles.spotBanner}>
              <span className={styles.dealerIcon} aria-hidden="true">
                <span className={styles.backCard}><span>A</span><b>♦</b></span>
                <span className={styles.frontCard}><span>A</span><b>♦</b></span>
                <span className={styles.pokerChip}><span /></span>
              </span>
              <span className={styles.spotCopy}><small>空いている日に、ディーラーとして活躍。</small><strong>スポット求人を探す</strong></span>
            </Link>
          )}
        </div>
        {latestNotice && (
          <Link href="/news" className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <span className="badge">運営からのお知らせ</span>
            <strong style={{ fontSize: 14.5 }}>{latestNotice.title}</strong>
            <span className="muted small">{formatDate(latestNotice.created_at)}</span>
          </Link>
        )}
        <div className={styles.layout}>
        <section className={styles.overview}>

        {profileEdit ? (<div className={`card ${profileEdit ? styles.account : ""}`} style={profileEdit ? undefined : { maxWidth: 680, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Avatar name={name} url={avatarUrl} size={profileEdit ? 72 : 56} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 19 }}>{name}</div>
                  {/* ハンドルネーム・都道府県の編集導線(2026/10、「変更できやん
                      ね、修正欄がない」との指摘を受けて追加)。 */}
                  <Link href="/account/profile" className="muted small" style={{ textDecoration: "underline" }}>
                    編集
                  </Link>
                  <Link href="/account/dealer" className="btn" style={{ fontSize: 12 }}>ディーラー登録</Link>
                </div>
                <div className="muted small">
                  📍 {pref || "未設定"}
                  {pref && !prefPublic && "（非公開）"} {joinedAt && `・ ${joinedAt}に登録`}
                </div>
              </div>
            </div>
            <div className={styles.accountActions}>
              <Link href="/account/password" className="btn" style={{ fontSize: 12.5 }}>
                <AccountIcon kind="lock" /> パスワード変更
              </Link>
              <Link href="/account/delete" className="btn" style={{ fontSize: 12.5 }}>
                <AccountIcon kind="user" /> 退会
              </Link>
              <form action={signOut}>
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  <AccountIcon kind="logout" /> ログアウト
                </button>
              </form>
            </div>
          </div>

          {/* アイコン画像の設定(2026/10、「会員マイページにアイコンを設定
              できるようにして、画像をアップロードしてサミット投稿一覧の
              丸い所に出るように」との指示)。 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              padding: "10px 0",
              borderTop: "1px solid var(--grid)",
              borderBottom: "1px solid var(--grid)",
            }}
          >
            <span className="muted small" style={{ marginRight: 2 }}>
              アイコン画像
            </span>
            <form action={uploadAvatar} encType="multipart/form-data" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="file" name="avatar" accept="image/*" required style={{ fontSize: 12.5 }} />
              <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                アップロード
              </button>
            </form>
            {avatarUrl && (
              <form action={removeAvatar}>
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  削除
                </button>
              </form>
            )}
            <span className="muted" style={{ fontSize: 11.5, width: "100%" }}>
              サミット（掲示板）の投稿一覧・詳細に表示されます（5MBまで）。
            </span>
          </div>

          <div className="muted small" style={{ marginTop: 10 }}>
            ✉️ {user.email} <span style={{ fontSize: 11, marginLeft: 8 }}>（{myProfile?.email_public === true ? "公開" : "非公開"}）</span>
          </div>
        </div>) : (
          <div className={styles.summary}>
            <div className={styles.identity}>
              <div className={styles.identityTop}><Avatar name={name} url={avatarUrl} size={84} /><div><div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:5}}><OfficialBadge show={isOfficial} /><span style={{fontSize:11,fontWeight:800,color:"#956d25"}}>{graduationScore!==null?"Lv.2 ポーカー卒業生":"Lv.1 ポーカー入門者"}</span><AcademyBadge score={graduationScore}/></div><strong className={styles.memberName}>{name}</strong><p className="muted small">📍 {pref || "未設定"} {pref && !prefPublic && "（非公開）"}{joinedAt && `・ ${joinedAt}に登録`}</p></div></div>
              {myProfile?.bio && <p className={styles.bio}>{myProfile.bio}</p>}
              <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:7}}>{myProfile?.role && <span className={styles.role} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><img src="/images/summit-finger-clean.webp" alt="" aria-hidden="true" width={22} height={28} style={{ width: 22, height: 28, objectFit: "contain", flexShrink: 0 }} />{myProfile.role}</span>}{graduationScore!==null&&<AcademyBadge score={graduationScore} compact/>}</div>
            </div>
            <dl className={styles.memberFacts}>
              <div><dt>✉ メールアドレス</dt><dd className={styles.email}>{user.email}<small>（{myProfile?.email_public === true ? "公開" : "非公開"}）</small></dd></div>
              <div><dt>▦ 登録日</dt><dd>{joinedAt || "未設定"}</dd></div>
              <div><dt>m HOLD’EM ID</dt><dd>{mHoldemId || "未登録"}<small>（非公開）</small></dd></div>
              <div><dt>♛ 会員ステータス</dt><dd>{isOfficial ? "運営" : "一般会員"}</dd></div>
              <div><dt>♙ 都道府県の公開設定</dt><dd>{prefPublic ? "公開（他の会員にも表示）" : "非公開（自分だけに表示）"}</dd></div>
            </dl>
            <div className={styles.summaryActions} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/account/profile" className="btn">プロフィール編集</Link>
                  <Link href="/account/dealer" className="btn">ディーラー登録</Link>
                </div>
                <div className={styles.accountActions}>
                  <Link href="/account/password" className="btn"><AccountIcon kind="lock" /> パスワード変更</Link>
                  <Link href="/account/delete" className="btn"><AccountIcon kind="user" /> 退会</Link>
                  <form action={signOut}><button type="submit" className="btn"><AccountIcon kind="logout" /> ログアウト</button></form>
                </div>
              </div>
              {dealerProfile && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Link href="/account/dealer/work" className="btn">✓ 勤務完了・レビュー</Link>
                  <Link href="/account/dealer/chat" className="btn">応募・チャット<NotificationBadge actor="dealer"/></Link>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.tiles}>
          {tabs.map((t) => (
            <BoardNotificationLink key={t.key} href={`/mypage?tab=${t.key}`} className={styles.tile} unread={t.unread>0} ownPostsOnly={t.key==="posts"}>
              <span className={styles.menuIcon} aria-hidden="true">{t.key === "boardNotifications" ? <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4M12 2V1"/></svg> : t.key === "posts" ? <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 3H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4l4 3v-3h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"/><path d="M7 8h10M7 12h7"/></svg> : t.icon}</span><span className={styles.menuText}><strong>{t.label}{t.unread>0 && <span className={styles.unreadDot} aria-label="新しい通知あり" />}</strong><small>{t.detail}</small></span><b aria-hidden="true">›</b>
            </BoardNotificationLink>
          ))}
        </div>

        {searchParams.tab && <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 10 }}>
          {tab === "favorites" &&
            (favStores.length === 0 ? (
              <p className="muted small">
                まだお気に入り店舗がありません。店舗ページの「☆ お気に入りに追加」から登録できます。
              </p>
            ) : (
              favStores.map((s: any) => (
                <div className="card" key={s.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Link href={`/stores/${s.id}`} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}><ReadableName name={s.name} /></div>
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

          {tab === "jobAlerts" && <div className="card" style={{padding:16}}>
            <h2 style={{fontSize:18,marginBottom:12}}>新着求人通知</h2>
            <p className="muted small">希望条件に合う新着求人をマイページに表示します。メール・外部通知は送信しません。通知をONにした後に公開された求人が対象です。募集終了・掲載期限切れ・削除された求人は通知一覧から自動的に消えます。</p>
            <form action={saveJobAlertPreferences}>
              <label style={{display:"flex",alignItems:"center",gap:8,margin:"12px 0"}}>
                <input type="checkbox" name="enabled" defaultChecked={alertPrefs?.enabled===true}/> 新着求人通知をONにする
              </label>
              <div className="field"><span>希望勤務地</span>
                <select name="pref" defaultValue={alertPrefs?.pref||""}>
                  <option value="">全国</option>
                  {PREF_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field"><span>経験条件</span>
                <select name="experience" defaultValue={alertPrefs?.experience_level||"any"}>
                  <option value="any">すべて</option>
                  <option value="beginner">未経験歓迎</option>
                  <option value="experienced">経験者募集</option>
                </select>
              </div>
              <button type="submit" className="btn primary">通知設定を保存する</button>
            </form>
            <h3 style={{fontSize:16,margin:"22px 0 10px"}}>条件に合う新着求人（{matchingJobs.length}件）</h3>
            {matchingJobs.length===0 && <p className="muted small">現在、条件に合う新着求人はありません。</p>}
            {matchingJobs.map((j:any)=><p key={j.id} style={{margin:"10px 0"}}>
              <Link href={`/jobs/${j.id}`}>{j.title}</Link> <span className="muted small">・{j.stores?.name}（{j.stores?.pref}）</span>
            </p>)}
          </div>}
          {tab === "favJobs" &&
            (favJobs.length === 0 ? (
              <p className="muted small">
                まだお気に入り求人がありません。求人一覧や求人詳細ページの「☆」ボタンから登録すると、あとでまとめて応募できます。
              </p>
            ) : (
              favJobs.map((j: any) => (
                <div className="card" key={j.id} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <Link href={`/jobs/${j.id}`} style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 800 }}><ReadableName name={j.title} /></div>
                    <div className="muted small">
                      {j.stores?.name && <ReadableName name={j.stores.name} />} ・ {j.stores?.pref}
                    </div>
                  </Link>
                  <div style={{ display: "flex", gap: 8 }}>
                    {appliedJobIds.has(j.id) ? (
                      <span className="badge good">✓ 応募済み</span>
                    ) : j.status === "open" ? (
                      <Link href={`/jobs/${j.id}#apply`} className="btn primary" style={{ fontSize: 12 }}>
                        応募する
                      </Link>
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
                        <div style={{ fontWeight: 800 }}><ReadableName name={j.title} /></div>
                        <div className="muted small">
                          {j.stores?.name && <ReadableName name={j.stores.name} />} ・ {j.stores?.pref}
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
              <h3 style={{ fontSize: 14.5 }}>☆ お気に入り ({favCoupons.length})</h3>
              {favCoupons.length === 0 ? <p className="muted small" style={{ marginBottom: 22 }}>保存したクーポンはありません。</p> : favCoupons.map((c: any) => (
                <div className="card" key={c.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {c.active ? <Link href={`/coupons/${c.id}`} style={{ fontWeight: 800 }}><ReadableName name={c.title} />{isCouponExpired(c) && "（期限切れ）"}</Link> : <strong><ReadableName name={c.title} />（掲載終了）</strong>}
                    <div className="muted small">{c.stores?.name && <ReadableName name={c.stores.name} />} ・ 期限 {couponExpiryLabel(c) ?? "なし"}</div>
                  </div>
                  <form action={async () => { "use server"; await setFavoriteCoupon(c.id, false); }}>
                    <button type="submit" className="btn" style={{ fontSize: 12 }}>解除</button>
                  </form>
                </div>
              ))}
              <h3 style={{ fontSize: 14.5 }}>未使用 ({unusedCoupons.length})</h3>
              {unusedCoupons.length === 0 ? (
                <p className="muted small" style={{ marginBottom: 22 }}>
                  未使用のクーポンはありません。
                </p>
              ) : (
                unusedCoupons.map((c: any) => (
                  <div className="card" key={c.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <Link href={`/coupons/${c.id}`} style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}><ReadableName name={c.title} /></div>
                      <div className="muted small">
                        {c.stores?.name && <ReadableName name={c.stores.name} />} ・ 期限 {couponExpiryLabel(c) ?? "なし"}
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
                      <div style={{ fontWeight: 800 }}><ReadableName name={c.title} /></div>
                      <div className="muted small">
                        {c.stores?.name && <ReadableName name={c.stores.name} />} ・ 期限 {couponExpiryLabel(c) ?? "なし"}
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
                    <div style={{ fontWeight: 800 }}><ReadableName name={ev.title} /></div>
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

          {(tab === "boardFollows" || tab === "boardNotifications") && <BoardPanel userId={user.id} notifications={tab === "boardNotifications"} page={Number(searchParams.boardPage || 1)} />}
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
        </div>}
        </section>
        {profileEdit ? <ProfileEditor dealerRegistration={dealerRegistration} name={name === "会員" ? "" : name} mHoldemId={mHoldemId} pref={pref} prefPublic={prefPublic} emailPublic={myProfile?.email_public === true} role={dealerRegistration ? (["ディーラー", "フリーディーラー"].includes(myProfile?.role || "") ? myProfile!.role : "ディーラー") : (myProfile?.role || "")} bio={myProfile?.bio || ""} error={searchParams.error} done={searchParams.done} /> : <aside className={styles.sidePanels}>
          <section className={styles.infoPanel}>
            <h2>♟ プロフィール</h2>
            <dl>
              <div><dt>ハンドルネーム</dt><dd>{name}</dd></div>
              <div><dt>都道府県</dt><dd>{pref || "未設定"}</dd></div>
              <div><dt>都道府県の公開設定</dt><dd>{prefPublic ? "公開（他の会員にも表示）" : "非公開（自分だけに表示）"}</dd></div>
              <div><dt>メールの公開設定</dt><dd>{myProfile?.email_public === true ? "公開" : "非公開"}</dd></div>
              <div><dt>活動スタイル</dt><dd>{myProfile?.role || "未設定"}</dd></div>
              <div><dt>フリーメッセージ</dt><dd className={styles.message}>{myProfile?.bio || "未設定"}</dd></div>
            </dl>
          </section>
          <section className={styles.infoPanel}>
            <h2>▥ 活動情報</h2>
            <dl>
              <div><dt>参加予定のイベント</dt><dd>{rsvpEvents.length} 件</dd></div>
              <div><dt>サミット投稿数</dt><dd>{myPosts?.length ?? 0} 件</dd></div>
            </dl>
          </section>
        </aside>}
        </div>
      </div>
      <PortalFooter />
      <BottomTabs active="mypage" />
    </div>
  );
}
