import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createPost } from "./actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { BOARD_CATEGORIES } from "@/lib/constants";

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

export default async function BoardPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const category = searchParams.category ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("board_posts")
    .select("id, title, author_name, created_at, category")
    .eq("status", "visible")
    .order("created_at", { ascending: false });
  if (category) query = query.eq("category", category);
  const { data: posts } = await query;

  const postIds = (posts ?? []).map((p) => p.id);
  const { data: replyRows } = postIds.length
    ? await supabase.from("board_replies").select("post_id").in("post_id", postIds)
    : { data: [] as { post_id: string }[] };
  const replyCounts: Record<string, number> = {};
  replyRows?.forEach((r) => {
    replyCounts[r.post_id] = (replyCounts[r.post_id] ?? 0) + 1;
  });

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container">
        <div className="section-head" style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22 }}>サミット（情報交換）</h1>
        </div>

        <div className="chip-row" style={{ marginBottom: 18 }}>
          <Link href="/board" className={`chip ${!category ? "active" : ""}`}>
            すべて
          </Link>
          {BOARD_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/board?category=${encodeURIComponent(c)}`}
              className={`chip ${category === c ? "active" : ""}`}
            >
              {c}
            </Link>
          ))}
        </div>

        <div className="card">
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>新規投稿</h2>
          <form action={createPost}>
            <div className="field">
              <span className="muted">お名前（未入力の場合は匿名）</span>
              <input type="text" name="authorName" placeholder="匿名" />
            </div>
            <div className="field">
              <span className="muted">カテゴリ</span>
              <select name="category" defaultValue="">
                <option value="">選択してください</option>
                {BOARD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
          <div className="empty">まだ投稿がありません。</div>
        )}

        {posts?.map((p) => (
          <Link href={`/board/${p.id}`} key={p.id} style={{ display: "block" }}>
            <div className="card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="avatar" style={{ background: avatarColor(p.author_name) }}>
                {p.author_name.slice(0, 1)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
                <div className="meta" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  {p.category && <span className="badge outline">{p.category}</span>}
                  <span className="muted">{p.author_name}</span>
                  <span className="muted">・ {formatDate(p.created_at)}</span>
                  <span className="muted">💬 {replyCounts[p.id] ?? 0}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <PortalFooter />
      <BottomTabs active="board" />
    </div>
  );
}
