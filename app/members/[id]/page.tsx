import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { Avatar } from "@/app/avatar";
import styles from "@/app/mypage/profile-layout.module.css";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP");
}

const POSTS_LIMIT = 20;

// 会員の公開プロフィールページ(2026/10、「サミットからアイコン押したら
// プロフィールが見れるように」との指示)。board/page.tsx・board/[id]/page.tsx
// のアイコンからここへリンクする。profilesテーブルは全員に公開読み取り
// 許可されている(RLS「profiles are publicly readable」)ため、未ログインの
// 訪問者にも見せて問題ない(サミットの投稿詳細自体は会員登録が必要だが、
// 一覧・アイコンは未ログインでも見えるのと同じ扱い)。
export default async function MemberProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const [{ data: { user } }, { data: profile }, { data: posts, count: postCount }, { data: replies, count: replyCount }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, role, bio, pref, pref_public, email_public, public_email")
      .eq("user_id", params.id)
      .maybeSingle(),
    supabase
      .from("board_posts")
      .select("id, title, created_at, category, author_name", { count: "exact" })
      .eq("author_user_id", params.id)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(POSTS_LIMIT),
    // 返信だけしかしていない会員の存在確認用(2026/10、「アイコン押したら
    // これ(404)」との報告を受けて追加)。投稿が1件もなくてもコメント
    // (board_replies)だけで参加している会員はいるので、投稿だけを見て
    // いると本人が実在するのに404になってしまっていた。
    supabase
      .from("board_replies")
      .select("author_name", { count: "exact" })
      .eq("author_user_id", params.id)
      .eq("status", "visible")
      .limit(1),
  ]);

  // profilesに行がなく、投稿・返信も1件もない場合は、このuser_idが実在する
  // 会員かどうかそもそも確認できないため404にする(auth.usersはサーバー側
  // からも直接は引けない。/account/profileを一度も保存していない会員は
  // profiles行が無いので、投稿か返信さえあれば存在確認として扱う)。
  if (!profile && (!posts || posts.length === 0) && (!replies || replies.length === 0)) {
    notFound();
  }

  // 表示名はprofiles.display_name(/account/profile保存時にミラーされる)を
  // 優先し、未設定なら本人の投稿・返信に残っているauthor_nameにフォールバックする。
  const fallbackName =
    (posts?.find((p: any) => p.author_name)?.author_name as string | undefined) ||
    (replies?.find((r: any) => r.author_name)?.author_name as string | undefined);
  const displayName = profile?.display_name || fallbackName || "名無しの会員";

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className={`container ${styles.page}`}>
        <Link href="/board" className="breadcrumb">← サミットに戻る</Link>
        <div className={styles.layout}>
          <section className={styles.overview}>
            <div className={styles.summary}>
              <div className={styles.identity}>
                <div className={styles.identityTop}>
                  <Avatar name={displayName} url={profile?.avatar_url ?? null} size={84} />
                  <div>
                    <strong className={styles.memberName}>{displayName}</strong>
                    <p className="muted small">📍 {profile?.pref_public === false ? "非公開" : profile?.pref || "未設定"}</p>
                  </div>
                </div>
                <p className={styles.bio}>{profile?.bio || "フリーメッセージは未設定です。"}</p>
                {profile?.role && <span className={styles.role}>♠ {profile.role}</span>}
              </div>
              <dl className={styles.memberFacts}>
                <div><dt>✉ メールアドレス</dt><dd className={styles.email}>{profile?.email_public === true && profile.public_email ? <a href={`mailto:${profile.public_email}`}>{profile.public_email}</a> : "非公開"}</dd></div>
                <div><dt>♛ 会員ステータス</dt><dd>一般会員</dd></div>
                <div><dt>♙ 都道府県の公開設定</dt><dd>{profile?.pref_public === false ? "非公開" : "公開（他の会員にも表示）"}</dd></div>
              </dl>
              {user?.id === params.id && <div className={styles.summaryActions}><Link href="/account/profile" className="btn">プロフィール編集</Link><Link href="/mypage" className="btn">マイページへ</Link></div>}
            </div>
            <div className={styles.tiles}>
              <a href="#member-posts" className={styles.tile}><span className={styles.menuIcon} aria-hidden="true">▧</span><span className={styles.menuText}><strong>サミットへの投稿</strong><small>{postCount ?? posts?.length ?? 0} 件</small></span><b aria-hidden="true">›</b></a>
              <div className={styles.tile}><span className={styles.menuIcon} aria-hidden="true">▤</span><span className={styles.menuText}><strong>コメント</strong><small>{replyCount ?? replies?.length ?? 0} 件</small></span></div>
            </div>
        <h2 id="member-posts" style={{ fontSize: 16, marginTop: 20, marginBottom: 10 }}>
          サミットへの投稿 ({postCount ?? posts?.length ?? 0})
        </h2>
        {(!posts || posts.length === 0) && (
          <p className="muted small">まだ投稿がありません。</p>
        )}
        {posts?.map((p: any) => (
          <Link href={`/board/${p.id}`} key={p.id} style={{ display: "block" }}>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
              <div className="meta" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                {p.category && <span className="badge outline">{p.category}</span>}
                <span className="muted" style={{ color: "var(--text-2)" }}>{formatDate(p.created_at)}</span>
              </div>
            </div>
          </Link>
        ))}
          </section>
          <aside className={styles.sidePanels}>
            <section className={styles.infoPanel}>
              <h2>♟ プロフィール</h2>
              <dl>
                <div><dt>ハンドルネーム</dt><dd>{displayName}</dd></div>
                <div><dt>都道府県</dt><dd>{profile?.pref_public === false ? "非公開" : profile?.pref || "未設定"}</dd></div>
                <div><dt>都道府県の公開設定</dt><dd>{profile?.pref_public === false ? "非公開" : "公開（他の会員にも表示）"}</dd></div>
                <div><dt>メールの公開設定</dt><dd>{profile?.email_public === true ? "公開" : "非公開"}</dd></div>
                <div><dt>役職</dt><dd>{profile?.role || "未設定"}</dd></div>
                <div><dt>フリーメッセージ</dt><dd className={styles.message}>{profile?.bio || "未設定"}</dd></div>
              </dl>
            </section>
            <section className={styles.infoPanel}>
              <h2>▥ 活動情報</h2>
              <dl>
                <div><dt>サミット投稿数</dt><dd>{postCount ?? posts?.length ?? 0} 件</dd></div>
                <div><dt>コメント数</dt><dd>{replyCount ?? replies?.length ?? 0} 件</dd></div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs active="board" />
    </div>
  );
}
