import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createReply, reportPost, reportReply } from "../actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

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

function avatarColor(name: string) {
  const colors = [
    "#3987e5",
    "#d95926",
    "#199e70",
    "#c98500",
    "#d55181",
    "#1fae1f",
    "#9085e9",
    "#e66767",
  ];
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % colors.length;
  return colors[h];
}

export default async function BoardPostPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: post } = await supabase
    .from("board_posts")
    .select("id, title, body, author_name, created_at, category")
    .eq("id", params.id)
    .eq("status", "visible")
    .maybeSingle();

  if (!post) {
    notFound();
  }

  const { data: replies } = await supabase
    .from("board_replies")
    .select("id, body, author_name, created_at")
    .eq("post_id", params.id)
    .eq("status", "visible")
    .order("created_at", { ascending: true });

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container" style={{ maxWidth: 640 }}>
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
            <div className="avatar" style={{ background: avatarColor(post.author_name) }}>
              {post.author_name.slice(0, 1)}
            </div>
            <div className="muted">
              {post.author_name} ・ {formatDate(post.created_at)}
            </div>
          </div>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{post.body}</p>
        </div>

        <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>
          コメント ({replies?.length ?? 0})
        </h2>

        {(!replies || replies.length === 0) && (
          <p className="muted small">まだコメントはありません。</p>
        )}

        {replies?.map((r) => (
          <div className="card" key={r.id} style={{ display: "flex", gap: 10 }}>
            <div className="avatar" style={{ background: avatarColor(r.author_name) }}>
              {r.author_name.slice(0, 1)}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {r.author_name}{" "}
                  <span className="muted small" style={{ fontWeight: 400 }}>
                    {formatDate(r.created_at)}
                  </span>
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
              <div style={{ fontSize: 13.5, marginTop: 2 }}>{r.body}</div>
            </div>
          </div>
        ))}

        {user ? (
          <div className="card" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 16, marginBottom: 10 }}>返信する</h2>
            <form action={createReply}>
              <input type="hidden" name="postId" value={post.id} />
              <div className="field">
                <span className="muted">お名前（未入力の場合は匿名）</span>
                <input type="text" name="authorName" placeholder="匿名" />
              </div>
              <div className="field">
                <span className="muted">返信内容 *</span>
                <textarea name="body" rows={3} required />
              </div>
              <button type="submit" className="btn primary">
                送信
              </button>
              <p className="muted small" style={{ marginTop: 8 }}>
                ⚠️ 不適切なコメントは運営者によって削除される場合があります。
              </p>
            </form>
          </div>
        ) : (
          <div className="card" style={{ marginTop: 16, textAlign: "center", padding: 20 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>
              コメントには会員登録（無料）が必要です
            </p>
            <p className="muted small" style={{ marginBottom: 14 }}>
              会員登録すると、スレッドへの投稿・コメントのほか、お気に入り登録・求人応募・クーポン利用・イベント参加登録もできるようになります。
            </p>
            <Link href="/signup" className="btn primary">
              ログイン / 会員登録（無料）
            </Link>
          </div>
        )}
      </div>
      <PortalFooter />
      <BottomTabs active="board" />
    </div>
  );
}
