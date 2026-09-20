import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createReply, reportPost, reportReply } from "../actions";

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

export default async function BoardPostPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("board_posts")
    .select("id, title, body, author_name, created_at")
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
      <header className="header">
        <Link href="/" className="brand">
          Poker Summit
        </Link>
        <Link href="/board" className="btn">
          掲示板一覧へ
        </Link>
      </header>
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <h1 style={{ fontSize: 19 }}>{post.title}</h1>
            <form
              action={async () => {
                "use server";
                await reportPost(post.id);
              }}
            >
              <button type="submit" className="btn" style={{ fontSize: 12 }}>
                通報
              </button>
            </form>
          </div>
          <div className="muted" style={{ marginBottom: 12 }}>
            {post.author_name} ・ {formatDate(post.created_at)}
          </div>
          <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>
        </div>

        <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>
          返信 ({replies?.length ?? 0})
        </h2>

        {replies?.map((r) => (
          <div className="card" key={r.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div className="muted">
                {r.author_name} ・ {formatDate(r.created_at)}
              </div>
              <form
                action={async () => {
                  "use server";
                  await reportReply(r.id, post.id);
                }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12 }}>
                  通報
                </button>
              </form>
            </div>
            <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{r.body}</p>
          </div>
        ))}

        <div className="card">
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
              返信する
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
