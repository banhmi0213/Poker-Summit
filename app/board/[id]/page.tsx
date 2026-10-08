import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createReply, reportPost, reportReply } from "../actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { Avatar } from "@/app/avatar";
import { MemberRoleBadge } from "@/app/member-role-badge";
import { NOINDEX } from "@/lib/seo";
export const metadata = NOINDEX;

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleString("ja-JP", {
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
  searchParams: { page?: string };
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
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ count: totalReplyCount }, { data: replies }] = await Promise.all([
    supabase
      .from("board_replies")
      .select("id", { count: "exact", head: true })
      .eq("post_id", params.id)
      .eq("status", "visible"),
    supabase
      .from("board_replies")
      .select("id, body, author_name, author_user_id, created_at, image_url")
      .eq("post_id", params.id)
      .eq("status", "visible")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  ]);

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
          ← スレッド一覧に戻る
        </Link>
        <div className="card">
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
              <h1 style={{ fontSize: 19 }}>{post.title}</h1>
            </div>
            <form
              action={async () => {
                "use server";
                await reportPost(post.id);
              }}
            >
              <button type="submit" className="btn" style={{ fontSize: 12 }}>
                🚩 通報する
              </button>
            </form>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
            {/* アイコンから投稿者のプロフィールへ(2026/10、「サミットから
                アイコン押したらプロフィールが見れるように」との指示)。 */}
            {post.author_user_id ? (
              <Link href={`/members/${post.author_user_id}`}>
                <Avatar name={post.author_name} url={avatarByUserId[post.author_user_id]} />
              </Link>
            ) : (
              <Avatar name={post.author_name} url={null} />
            )}
            <div style={{ minWidth: 0 }}>
              <MemberRoleBadge role={post.author_user_id ? roleByUserId[post.author_user_id] : null} />
              <div className="muted">
                {post.author_name} ・ {formatDate(post.created_at)}
              </div>
            </div>
          </div>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{post.body}</p>
          {post.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
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
          コメント ({totalReplyCount ?? 0})
        </h2>

        {(!replies || replies.length === 0) && (
          <p className="muted small">まだコメントはありません。</p>
        )}

        {replies?.map((r) => (
          <div className="card" key={r.id} style={{ display: "flex", gap: 10 }}>
            {r.author_user_id ? (
              <Link href={`/members/${r.author_user_id}`} style={{ flexShrink: 0 }}>
                <Avatar name={r.author_name} url={avatarByUserId[r.author_user_id]} />
              </Link>
            ) : (
              <Avatar name={r.author_name} url={null} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <MemberRoleBadge role={r.author_user_id ? roleByUserId[r.author_user_id] : null} />
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                    {r.author_name}{" "}
                    <span className="muted small" style={{ fontWeight: 400 }}>
                      {formatDate(r.created_at)}
                    </span>
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await reportReply(r.id, post.id);
                  }}
                >
                  <button type="submit" className="btn" style={{ fontSize: 11 }}>
                    🚩
                  </button>
                </form>
              </div>
              <div style={{ fontSize: 13.5, marginTop: 2, whiteSpace: "pre-wrap" }}>{r.body}</div>
              {r.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.image_url}
                  alt=""
                  style={{
                    maxWidth: "100%",
                    maxHeight: 280,
                    objectFit: "contain",
                    borderRadius: 8,
                    marginTop: 8,
                    background: "var(--surface-2)",
                  }}
                />
              )}
            </div>
          </div>
        ))}

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
                ← 前へ
              </Link>
            ) : (
              <span className="btn" style={{ padding: "6px 14px", opacity: 0.4, pointerEvents: "none" }}>
                ← 前へ
              </span>
            )}
            <span className="muted" style={{ fontSize: 13 }}>
              {page} / {totalPages} ページ
            </span>
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="btn" style={{ padding: "6px 14px" }}>
                次へ →
              </Link>
            ) : (
              <span className="btn" style={{ padding: "6px 14px", opacity: 0.4, pointerEvents: "none" }}>
                次へ →
              </span>
            )}
          </div>
        )}

        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>返信する</h2>
          <form action={createReply} encType="multipart/form-data">
            <input type="hidden" name="postId" value={post.id} />
            <div className="field">
              <span className="muted">お名前（空欄で投稿すると匿名になります）</span>
              <input type="text" name="authorName" defaultValue={authorDisplayName} placeholder="匿名" />
            </div>
            <div className="field">
              <span className="muted">返信内容 *</span>
              <textarea name="body" rows={3} required />
            </div>
            <div className="field">
              <span className="muted">画像を添付（任意）</span>
              <input type="file" name="image" accept="image/*" />
            </div>
            <button type="submit" className="btn primary">
              送信
            </button>
            <p className="muted small" style={{ marginTop: 8 }}>
              ⚠️ 不適切なコメントは運営者によって削除される場合があります。
            </p>
          </form>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs active="board" />
    </div>
  );
}
