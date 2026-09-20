import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { setPostStatus, setReplyStatus, deletePostByAdmin } from "./actions";
import { BOARD_CATEGORIES } from "@/lib/constants";

function formatDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP");
}

export default async function AdminBoardPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q ?? "";
  const category = searchParams.category ?? "";

  let query = supabase
    .from("board_posts")
    .select("id, title, author_name, category, status, created_at")
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }
  if (q) {
    query = query.or(`title.ilike.%${q}%,author_name.ilike.%${q}%`);
  }

  const { data: posts } = await query;
  const postIds = (posts ?? []).map((p) => p.id);

  const [{ data: replies }, { data: openReports }] = await Promise.all([
    postIds.length > 0
      ? supabase.from("board_replies").select("id, post_id").in("post_id", postIds)
      : Promise.resolve({ data: [] as { id: string; post_id: string }[] }),
    supabase
      .from("reports")
      .select("target_type, target_id")
      .eq("status", "open")
      .in("target_type", ["post", "reply"]),
  ]);

  const replyCounts = new Map<string, number>();
  const replyPostMap = new Map<string, string>();
  (replies ?? []).forEach((r) => {
    replyCounts.set(r.post_id, (replyCounts.get(r.post_id) ?? 0) + 1);
    replyPostMap.set(r.id, r.post_id);
  });

  const reportCounts = new Map<string, number>();
  (openReports ?? []).forEach((r) => {
    const postId =
      r.target_type === "post" ? r.target_id : replyPostMap.get(r.target_id);
    if (postId) {
      reportCounts.set(postId, (reportCounts.get(postId) ?? 0) + 1);
    }
  });

  const { data: hiddenReplies } = await supabase
    .from("board_replies")
    .select("id, body, author_name, post_id, created_at")
    .eq("status", "hidden")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>スレッド管理</h1>

      <form style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="タイトル・投稿者で検索"
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
            width: 240,
          }}
        />
        <select
          name="category"
          defaultValue={category}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
          }}
        >
          <option value="">カテゴリ: すべて</option>
          {BOARD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="submit" className="btn">
          検索
        </button>
      </form>

      {(!posts || posts.length === 0) && <p className="muted">該当するスレッドはありません。</p>}

      {posts && posts.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>投稿者</th>
              <th>タイトル</th>
              <th>カテゴリ</th>
              <th>投稿日</th>
              <th>コメント数</th>
              <th>ステータス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => {
              const repCount = reportCounts.get(p.id) ?? 0;
              return (
                <tr key={p.id}>
                  <td>{p.author_name}</td>
                  <td>
                    {p.title}{" "}
                    {repCount > 0 && (
                      <Link href={`/board/${p.id}`} className="badge" style={{ marginLeft: 6 }}>
                        🚨 通報あり({repCount})
                      </Link>
                    )}
                  </td>
                  <td>{p.category ?? ""}</td>
                  <td>{formatDate(p.created_at)}</td>
                  <td className="tabular">{replyCounts.get(p.id) ?? 0}</td>
                  <td>
                    <span className="badge">{p.status === "hidden" ? "非公開" : "公開中"}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Link href={`/board/${p.id}`} className="btn" style={{ fontSize: 12 }}>
                        内容を見る
                      </Link>
                      <form
                        action={async () => {
                          "use server";
                          await setPostStatus(p.id, p.status === "hidden" ? "visible" : "hidden");
                        }}
                      >
                        <button type="submit" className="btn" style={{ fontSize: 12 }}>
                          {p.status === "hidden" ? "公開に戻す" : "非公開にする"}
                        </button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await deletePostByAdmin(p.id);
                        }}
                      >
                        <button type="submit" className="btn" style={{ fontSize: 12 }}>
                          削除
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 16, marginTop: 28, marginBottom: 10 }}>
        非公開の返信 ({hiddenReplies?.length ?? 0})
      </h2>
      {(!hiddenReplies || hiddenReplies.length === 0) && (
        <p className="muted">非公開の返信はありません。</p>
      )}
      {hiddenReplies?.map((r) => (
        <div className="card" key={r.id}>
          <p>{r.body}</p>
          <div className="muted">{r.author_name}</div>
          <form
            action={async () => {
              "use server";
              await setReplyStatus(r.id, "visible");
            }}
            style={{ marginTop: 8 }}
          >
            <button type="submit" className="btn">
              公開に戻す
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
