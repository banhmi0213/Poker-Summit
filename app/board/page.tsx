import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createPost } from "./actions";

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

export default async function BoardPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("board_posts")
    .select("id, title, author_name, created_at")
    .eq("status", "visible")
    .order("created_at", { ascending: false });

  return (
    <div>
      <header className="header">
        <Link href="/" className="brand">
          Poker Summit
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/events" className="btn">
            イベント
          </Link>
          <Link href="/jobs" className="btn">
            求人
          </Link>
        </div>
      </header>
      <div className="container">
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>掲示板</h1>

        <div className="card">
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>新規投稿</h2>
          <form action={createPost}>
            <div className="field">
              <span className="muted">お名前（未入力の場合は匿名）</span>
              <input type="text" name="authorName" placeholder="匿名" />
            </div>
            <div className="field">
              <span className="muted">タイトル *</span>
              <input type="text" name="title" required />
            </div>
            <div className="field">
              <span className="muted">本文 *</span>
              <textarea name="body" rows={4} required />
            </div>
            <button type="submit" className="btn primary">
              投稿する
            </button>
          </form>
        </div>

        {(!posts || posts.length === 0) && (
          <p className="muted">まだ投稿がありません。</p>
        )}

        {posts?.map((p) => (
          <Link href={`/board/${p.id}`} key={p.id} style={{ display: "block" }}>
            <div className="card">
              <h3>{p.title}</h3>
              <div className="muted">
                {p.author_name} ・ {formatDate(p.created_at)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
