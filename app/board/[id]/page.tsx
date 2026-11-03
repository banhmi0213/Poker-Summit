import { threadCardStyle, threadStyle, validCode } from "@/lib/cosmetics";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reportPost } from "../actions";
import { ReportForm } from "@/app/report-form";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { Avatar } from "@/app/avatar";
import { MemberRoleBadge, OfficialBadge } from "@/app/member-role-badge";
import { AcademyBadge } from "@/app/learn/academy-badge";
import { BoardBody, BoardHelp, ThreadControls, ReactionButtons, ReplyComposer, ReplyConversation } from "../community";
import { getThreadCommunity, isMissingBoardSchema } from "../community-data";
import { NOINDEX } from "@/lib/seo";
export const metadata = NOINDEX;

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAGE_SIZE = 100;

export default async function BoardPostPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { page?: string; focus?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // スレッド一覧(/board)は誰でも見れるが、スレッド詳細(本文・コメント)の
  // 閲覧は会員登録必須にする(2026/10、「サミット観覧には会員登録が必要」
  // との指示)。未ログインならここでログイン画面へ誘導する。
  // 返信フォームのお名前欄、デフォルトは会員名(2026/10、「名前欄には会員名
  // をデフォで」との指示、/board一覧の新規投稿フォームと同じ対応)。
  const authorDisplayName = (user?.user_metadata as any)?.display_name || "";

  if (!user) {
    redirect(`/login?next=/board/${params.id}`);
  }

  const { data: post } = await supabase
    .from("board_posts")
    .select("id, title, body, author_name, author_user_id, created_at, category, image_url")
    .eq("id", params.id)
    .eq("status", "visible")
    .maybeSingle();

  if (!post) {
    notFound();
  }

  // コメントのページ送り(2026/10、「スレッドの中身も100件でページ送りに
  // して」との指示。/boardのスレッド一覧と同じ1ページ100件固定方式)。
  // 投稿順(古い順)のまま、100件ごとに区切る。
  let page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  let focusedRoot: string | undefined;
  if (searchParams.focus && /^[0-9a-f-]{36}$/i.test(searchParams.focus)) {
    const { data: focused } = await supabase.from("board_replies").select("id,parent_reply_id").eq("id", searchParams.focus).eq("post_id", params.id).eq("status", "visible").maybeSingle();
    if (focused) {
      const { data: root } = await supabase.from("board_replies").select("id,created_at").eq("id", focused.parent_reply_id || focused.id).eq("post_id", params.id).eq("status", "visible").maybeSingle();
      if (root) {
        focusedRoot = root.id;
        const { count } = await supabase.from("board_replies").select("id", {count:"exact",head:true}).eq("post_id", params.id).eq("status","visible").is("parent_reply_id",null).or(`created_at.lt.${root.created_at},and(created_at.eq.${root.created_at},id.lt.${root.id})`);
        page = Math.floor((count ?? 0) / PAGE_SIZE) + 1;
      }
    }
  }
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let [{ count: totalReplyCount, error: countError }, { data: replies, error: repliesError }] = await Promise.all([
    supabase
      .from("board_replies")
      .select("id", { count: "exact", head: true })
      .eq("post_id", params.id)
      .eq("status", "visible").is("parent_reply_id", null),
    supabase
      .from("board_replies")
      .select("id, post_id, body, author_name, author_user_id, created_at, image_url, parent_reply_id")
      .eq("post_id", params.id)
      .eq("status", "visible")
      .is("parent_reply_id", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  ]);

  // A preview may be deployed before its database migration. Preserve the
  // existing read-only thread instead of crashing or pretending new tools work.
  if (isMissingBoardSchema(countError) || isMissingBoardSchema(repliesError)) {
    const [legacyCount, legacyReplies] = await Promise.all([
      supabase.from("board_replies").select("id", {count:"exact",head:true}).eq("post_id",params.id).eq("status","visible"),
      supabase.from("board_replies").select("id,post_id,body,author_name,author_user_id,created_at,image_url").eq("post_id",params.id).eq("status","visible").order("created_at",{ascending:true}).order("id",{ascending:true}).range(from,to),
    ]);
    totalReplyCount = legacyCount.count;
    replies = (legacyReplies.data ?? []).map(r=>({...r,parent_reply_id:null}));
    countError = legacyCount.error; repliesError = legacyReplies.error;
  }
  if (countError || repliesError) throw new Error("コメントを読み込めませんでした。");
  const community = await getThreadCommunity(supabase, post.id, user.id, (replies ?? []).map(r=>r.id));
  const {data:followCounts}=community ? await supabase.rpc("board_follow_counts",{p_post_ids:[post.id]}) : {data:null};
  const followerCount=Number(followCounts?.[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil((totalReplyCount ?? 0) / PAGE_SIZE));

  // 投稿者・返信者のアイコン画像(2026/10、board/page.tsxと同じ理由で
  // まとめて1回で引く)。スレッド本文の投稿者 + このページの返信者ぶん。
  const authorUserIds = Array.from(
    new Set(
      [post.author_user_id, ...(replies ?? []).map((r) => r.author_user_id)].filter(
        (id): id is string => Boolean(id)
      )
    )
  );
  const { data: authorProfiles } = authorUserIds.length
    ? await supabase.from("profiles").select("user_id, avatar_url, role").in("user_id", authorUserIds)
    : { data: [] as { user_id: string; avatar_url: string | null; role: string | null }[] };
  const { data: badgeRows } = authorUserIds.length
    ? await supabase.from("academy_graduation").select("user_id, best_score").in("user_id", authorUserIds)
    : { data: [] as { user_id: string; best_score: number }[] };
  // 「運営」バッジを付ける運営アカウント(2026/10/20)
  const { data: officialRows } = authorUserIds.length
    ? await supabase.rpc("official_board_user_ids", { p_ids: authorUserIds })
    : { data: [] as string[] };
  const officialIds = new Set<string>(((officialRows ?? []) as unknown[]).map((r) => String(r)));
  const graduationByUserId: Record<string, number> = {};
  badgeRows?.forEach(row => { graduationByUserId[row.user_id] = row.best_score; });
  // アイコン枠・スレッドデザイン(2026/11/01)。投稿者・返信者ぶんを1回でまとめて引く。
  const { data: cosmeticRows } = authorUserIds.length
    ? await supabase.rpc("poker_cosmetics_for", { p_members: authorUserIds })
    : { data: [] };
  const frameByUserId: Record<string, string | null> = {};
  const threadByUserId: Record<string, string | null> = {};
  (Array.isArray(cosmeticRows) ? (cosmeticRows as { userId?: unknown; frame?: unknown; thread?: unknown }[]) : []).forEach((c) => {
    if (typeof c?.userId !== "string") return;
    frameByUserId[c.userId] = validCode(c.frame, "frame");
    threadByUserId[c.userId] = validCode(c.thread, "thread");
  });
  const threadDesign = post.author_user_id ? threadByUserId[post.author_user_id] : null;
  const avatarByUserId: Record<string, string | null> = {};
  // 投稿者・返信者の役職(2026/10、「サミットアイコン横の名前の上に役職を
  // 表示」との指示)。board/page.tsxと同じくavatar_urlと一緒にまとめて引く。
  const roleByUserId: Record<string, string | null> = {};
  authorProfiles?.forEach((p) => {
    avatarByUserId[p.user_id] = p.avatar_url;
    roleByUserId[p.user_id] = p.role;
  });

  function pageHref(p: number) {
    return p > 1 ? `/board/${params.id}?page=${p}` : `/board/${params.id}`;
  }

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container detail-readable" style={{ maxWidth: 640 }}>
        <Link href="/board" className="breadcrumb">
          スレッド一覧に戻る
        </Link>
        <div className="card" style={threadCardStyle(threadDesign)}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <div>
              {post.category && (
                <div className="meta" style={{ marginBottom: 6 }}>
                  <span className="badge outline">{post.category}</span>
                </div>
              )}
              <h1 style={{ fontSize: 19 }}>{post.title}{(() => { const t = threadStyle(threadDesign).badge; return t && <span style={t.style}>{t.text}</span>; })()}</h1>
            </div>
            <ReportForm kind="post" label="🚩 通報する" action={reportPost.bind(null, post.id)} buttonStyle={{ fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
            {/* アイコンから投稿者のプロフィールへ(2026/10、「サミットから
                アイコン押したらプロフィールが見れるように」との指示)。 */}
            {post.author_user_id ? (
              <Link href={`/members/${post.author_user_id}`}>
                <Avatar name={post.author_name} url={avatarByUserId[post.author_user_id]} frame={frameByUserId[post.author_user_id]} />
              </Link>
            ) : (
              <Avatar name={post.author_name} url={null} />
            )}
            <div style={{ minWidth: 0 }}>
              <span style={{display:"inline-flex",gap:5,alignItems:"center",flexWrap:"wrap"}}><OfficialBadge show={!!post.author_user_id && officialIds.has(post.author_user_id)} /><MemberRoleBadge role={post.author_user_id ? roleByUserId[post.author_user_id] : null} /><AcademyBadge score={post.author_user_id ? graduationByUserId[post.author_user_id] : null} compact/></span>
              <div className="muted">
                {post.author_name} ・ {formatDate(post.created_at)}
              </div>
            </div>
          </div>
          {community ? <ThreadControls postId={post.id} preference={community.preference} followerCount={followerCount} resolved={community.resolved} owner={post.author_user_id === user.id} /> : <p role="status" className="muted">掲示板の追加機能は準備中です。現在は本文・コメントの閲覧のみご利用いただけます。</p>}
          <BoardBody body={post.body} />
          {community && <ReactionButtons postId={post.id} rows={community.reactions} userId={user.id} />}
          {post.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async"
              src={post.image_url}
              alt=""
              style={{
                width: "100%",
                maxHeight: 420,
                objectFit: "contain",
                borderRadius: 10,
                marginTop: 12,
                background: "var(--surface-2)",
              }}
            />
          )}
        </div>

        <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>
          コメント・返信 ({community?.totalReplies ?? totalReplyCount ?? 0})
        </h2>

        {(!replies || replies.length === 0) && (
          <p className="muted small">まだコメントはありません。</p>
        )}

        {community ? replies?.map(r => <ReplyConversation key={r.id} reply={r} postId={post.id} userId={user.id} authorName={authorDisplayName} owner={post.author_user_id === user.id} resolutionId={community.resolutionId} resolved={community.resolved} reactions={community.reactions} childCount={community.counts[r.id] ?? 0} focusReplyId={focusedRoot === r.id ? searchParams.focus : undefined} authors={Object.fromEntries(authorUserIds.map(id => [id, {avatar:avatarByUserId[id], frame:frameByUserId[id], role:roleByUserId[id], official:officialIds.has(id),score:graduationByUserId[id]}]))} />) : replies?.map(r => <article className="card" key={r.id} style={{marginBottom:12}}><p className="muted small">{r.author_name} ・ {formatDate(r.created_at)}</p><BoardBody body={r.body} />{r.image_url && <img src={r.image_url} alt="" loading="lazy" style={{maxWidth:"100%",maxHeight:420,objectFit:"contain"}} />}</article>)}

        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              marginTop: 14,
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="btn" style={{ padding: "6px 14px" }}>
                前へ
              </Link>
            ) : (
              <span className="btn" style={{ padding: "6px 14px", opacity: 0.4, pointerEvents: "none" }}>
                前へ
              </span>
            )}
            <span className="muted" style={{ fontSize: 13 }}>
              {page} / {totalPages} ページ
            </span>
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="btn" style={{ padding: "6px 14px" }}>
                次へ
              </Link>
            ) : (
              <span className="btn" style={{ padding: "6px 14px", opacity: 0.4, pointerEvents: "none" }}>
                次へ
              </span>
            )}
          </div>
        )}

        {community && <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{fontSize:16}}>スレッドにコメントする</h2>
          <ReplyComposer postId={post.id} authorName={authorDisplayName} />
        </div>}
        <BoardHelp />
      </div>
      <PortalFooter />
      <BottomTabs active="board" />
    </div>
  );
}
