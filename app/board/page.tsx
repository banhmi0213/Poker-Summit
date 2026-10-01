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

const PAGE_SIZE = 100;

export default async function BoardPage({
  searchParams,
}: {
  searchParams: { category?: string; page?: string };
}) {
  const category = searchParams.category ?? "";
  // スレッド一覧のページ送り(2026/10、「100件でページ送りで」との指示)。
  // 1ページ100件固定。カテゴリ絞り込みと組み合わせても動くよう、ページ数は
  // 絞り込み後の件数から計算する。
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let countQuery = supabase
    .from("board_posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "visible");
  if (category) countQuery = countQuery.eq("category", category);

  // スレッド一覧の並び順(2026/10、「スレッド一覧は更新があれば一番先頭に
  // 来るように」との指示)。返信があるたびにcreateReply側でboard_posts.
  // updated_atを更新しているので、作成日時(created_at)ではなく更新日時
  // (updated_at、新規投稿時点ではcreated_atと同じ)でソートする。
  let query = supabase
    .from("board_posts")
    .select("id, title, author_name, created_at, updated_at, category, image_url")
    .eq("status", "visible")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });
  if (category) query = query.eq("category", category);
  query = query.range(from, to);

  const [{ count: totalCount }, { data: posts }] = await Promise.all([countQuery, query]);
  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/board${qs ? `?${qs}` : ""}`;
  }

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

        {user ? (
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
              <div className="field">
                <span className="muted">画像（任意）</span>
                <input type="file" name="image" accept="image/*" />
                <span className="muted" style={{ fontSize: 11.5 }}>
                  1枚まで添付できます（8MBまで）。
                </span>
              </div>
              <button type="submit" className="btn primary">
                投稿する
              </button>
            </form>
          </div>
        ) : (
          // 投稿には会員登録が必要(2026/10、「サミット投稿・観覧・返信には
          // 会員登録が必要」との指示)。一覧自体は誰でも見れるが、投稿フォーム
          // はログイン済みの人にしか表示しない(サーバー側の強制はcreatePost
          // 側のrequireUser()で行う。こちらはUIのみ)。
          <div className="card" style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>
              投稿には会員登録（無料）が必要です
            </p>
            <p className="muted small" style={{ marginBottom: 14 }}>
              会員登録すると、スレッドの投稿・閲覧・コメントのほか、お気に入り登録・求人応募・クーポン利用・イベント参加登録もできるようになります。
            </p>
            <Link href="/signup" className="btn primary">
              ログイン / 会員登録（無料）
            </Link>
          </div>
        )}

        {(!posts || posts.length === 0) && (
          <div className="empty">まだ投稿がありません。</div>
        )}

        {posts?.map((p) => (
          <Link href={`/board/${p.id}`} key={p.id} style={{ display: "block" }}>
            <div className="card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="avatar" style={{ background: avatarColor(p.author_name) }}>
                {p.author_name.slice(0, 1)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
                <div className="meta" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  {p.category && <span className="badge outline">{p.category}</span>}
                  <span className="muted">{p.author_name}</span>
                  <span className="muted">・ {formatDate(p.created_at)}</span>
                  <span className="muted">💬 {replyCounts[p.id] ?? 0}</span>
                </div>
              </div>
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt=""
                  style={{
                    width: 56,
                    height: 56,
                    objectFit: "cover",
                    borderRadius: 8,
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          </Link>
        ))}

        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              marginTop: 18,
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
      </div>
      <PortalFooter />
      <BottomTabs active="board" />
    </div>
  );
}
