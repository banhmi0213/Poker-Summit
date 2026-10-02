import Link from "next/link";
import Image from "next/image";
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
  searchParams: { category?: string; page?: string; q?: string; sort?: string };
}) {
  const category = searchParams.category ?? "";
  const q = searchParams.q?.trim() ?? "";
  // 並び替え(2026/10、「キーワード検索・新着順／更新順を追加してほしい」との
  // 指示、その後「新着を先に持ってきて」との指示で既定を新着順に変更)。
  // 「new」(既定、新着順=作成日時順)と「updated」(更新順)の2択。
  const sort = searchParams.sort === "updated" ? "updated" : "new";
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
  if (q) countQuery = countQuery.or(`title.ilike.%${q}%,body.ilike.%${q}%`);

  // スレッド一覧の並び順。既定は新着順(created_at、2026/10「新着を先に
  // 持ってきて」との指示)。sort=updatedが指定された場合のみ更新日時
  // (updated_at、返信があるたびにcreateReply側で更新している。新規投稿
  // 時点ではcreated_atと同じ)に切り替える(2026/10「スレッド一覧は更新が
  // あれば一番先頭に来るように」との旧指示を踏襲したオプションとして残す)。
  let query = supabase
    .from("board_posts")
    .select("id, title, author_name, created_at, updated_at, category, image_url")
    .eq("status", "visible")
    .order(sort === "updated" ? "updated_at" : "created_at", { ascending: false })
    .order("id", { ascending: false });
  if (category) query = query.eq("category", category);
  if (q) query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
  query = query.range(from, to);

  const [{ count: totalCount }, { data: posts }] = await Promise.all([countQuery, query]);
  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  function buildHref(
    overrides: { category?: string; q?: string; sort?: string; page?: number } = {}
  ) {
    const nextCategory = overrides.category !== undefined ? overrides.category : category;
    const nextQ = overrides.q !== undefined ? overrides.q : q;
    const nextSort = overrides.sort !== undefined ? overrides.sort : sort;
    const nextPage = overrides.page !== undefined ? overrides.page : page;
    const params = new URLSearchParams();
    if (nextCategory) params.set("category", nextCategory);
    if (nextQ) params.set("q", nextQ);
    if (nextSort && nextSort !== "new") params.set("sort", nextSort);
    if (nextPage > 1) params.set("page", String(nextPage));
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
        <h1 className="portal-banner" style={{ margin: "0 0 20px", height: 190, overflow: "hidden", borderRadius: 10 }}>
          <picture>
            <source media="(min-width: 861px)" srcSet="/images/summit-community-beige-banner.jpg" />
          <Image
            src="/images/summit-community-banner.jpg"
            alt="サミット｜情報交換 — ポーカーの話題で、つながろう。雑談・初心者質問・大会情報・おすすめ店舗・攻略・戦略"
            width={2048}
            height={682}
            quality={95}
            priority
            sizes="(max-width: 1180px) 100vw, 1140px"
            style={{ display: "block", width: "100%", height: "100%", objectFit: "fill" }}
          />
          </picture>
        </h1>

        <div className="chip-row" style={{ marginBottom: 18 }}>
          <Link href={buildHref({ category: "", page: 1 })} className={`chip ${!category ? "active" : ""}`}>
            すべて
          </Link>
          {BOARD_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={buildHref({ category: c, page: 1 })}
              className={`chip ${category === c ? "active" : ""}`}
            >
              {c}
            </Link>
          ))}
        </div>

        {/* キーワード検索・並び替え(2026/10、「投稿が増えたときに備えて検索と
            並び替えがあると便利」との指示)。カテゴリ絞り込み(チップ)は維持した
            まま検索・並び替えできるよう、現在のcategoryを隠しフィールドで
            引き継ぐ。送信時はページ指定を持たないので自然に1ページ目に戻る。 */}
        <form method="get" style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <input type="hidden" name="category" value={category} />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="キーワードで検索"
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-2)",
              fontSize: 13,
              flex: "2 1 220px",
            }}
          />
          <select
            name="sort"
            defaultValue={sort}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-2)",
              fontSize: 13,
              flex: "1 1 140px",
            }}
          >
            <option value="new">新着順</option>
            <option value="updated">更新順</option>
          </select>
          <button type="submit" className="btn primary" style={{ fontSize: 13 }}>
            検索
          </button>
        </form>

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
          // 2026/10、「投稿一覧より目立っている。テキストとボタンを横並び
          // にする程度で十分」との指示により、中央寄せの大きいカードから
          // 1行の案内バー(テキスト+ボタン)に縮小した。
          <div
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              padding: "10px 14px",
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: 13, margin: 0 }}>投稿には無料会員登録が必要です</p>
            <Link href="/signup" className="btn primary" style={{ fontSize: 12.5, padding: "6px 14px" }}>
              ログイン / 会員登録
            </Link>
          </div>
        )}

        {(!posts || posts.length === 0) && (
          <div className="empty">
            {q || category ? "該当する投稿が見つかりませんでした。" : "まだ投稿がありません。"}
          </div>
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
                  {/* 投稿者名・日時のコントラスト向上(2026/10、「薄い文字を
                      少し濃くすると読みやすくなる」との指示)。--mutedは
                      コントラスト比が低いため、サイト全体の.mutedは変えず
                      このメタ情報だけ--text-2(より濃い色)で上書きする。 */}
                  <span className="muted" style={{ color: "var(--text-2)" }}>{p.author_name}</span>
                  <span className="muted" style={{ color: "var(--text-2)" }}>・ {formatDate(p.created_at)}</span>
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
              <Link href={buildHref({ page: page - 1 })} className="btn" style={{ padding: "6px 14px" }}>
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
              <Link href={buildHref({ page: page + 1 })} className="btn" style={{ padding: "6px 14px" }}>
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
