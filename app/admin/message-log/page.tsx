import { createClient } from "@/lib/supabase/server";

// サイトから送ったメール・LINEの記録(2026/10/20)。お知らせ・請求書・決済・会員・マッチングの通知など全部。
// パスワード・確認コード・ログイン情報を含むものは本文を残していない。
const CHANNEL: Record<string, string> = { email: "メール", line: "LINE" };
const STATUS: Record<string, string> = { sent: "送信済み", failed: "失敗", skipped: "送らず" };

export default async function MessageLogPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const supabase = await createClient();
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const size = 50;
  let query = supabase
    .from("message_log")
    .select("id, channel, to_address, subject, body, sensitive, has_attachment, status, error, created_at, stores(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  if (q) query = query.or(`to_address.ilike.%${q.replace(/[%,()]/g, "")}%,subject.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data: rows, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / size));

  return (
    <div className="container">
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>送信履歴（メール・LINE）</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.8 }}>
        サイトから送ったメール・LINEをすべて記録しています（お知らせ・請求書・決済・会員・マッチングの通知など。2026年10月20日から）。
        パスワード・確認コード・ログイン情報を含むものは本文を残していません。会員登録の確認メールはログインの仕組み(Supabase)から送るため、ここには出ません。
      </p>
      <form style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input name="q" defaultValue={q} placeholder="宛先・件名で検索" style={{ flex: "1 1 240px" }} />
        <button type="submit" className="btn">検索</button>
      </form>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{(count ?? 0).toLocaleString()}件</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(rows ?? []).map((r: any) => (
          <details key={r.id} className="card" style={{ padding: "10px 14px" }}>
            <summary style={{ cursor: "pointer", fontSize: 13.5, lineHeight: 1.7 }}>
              <span className="badge outline" style={{ marginRight: 6 }}>{CHANNEL[r.channel] ?? r.channel}</span>
              <span className="badge" style={{ marginRight: 6, ...(r.status === "failed" ? { background: "#fde8e6", color: "#d1453b" } : {}) }}>{STATUS[r.status] ?? r.status}</span>
              <strong>{r.subject ?? (r.body ?? "").slice(0, 40)}</strong>
              <span className="muted" style={{ display: "block", fontSize: 12 }}>
                {new Date(r.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}・宛先：{r.to_address}
                {(Array.isArray(r.stores) ? r.stores[0] : r.stores)?.name ? `（${(Array.isArray(r.stores) ? r.stores[0] : r.stores).name}）` : ""}
                {r.has_attachment ? "・添付あり" : ""}
              </span>
            </summary>
            {r.error && <p style={{ color: "#d1453b", fontSize: 12.5, marginTop: 6 }}>{r.error}</p>}
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, marginTop: 8, fontFamily: "inherit" }}>{r.sensitive ? "（パスワード等を含むため本文は保存していません）" : r.body ?? ""}</pre>
          </details>
        ))}
        {(rows ?? []).length === 0 && <p className="muted">まだ記録はありません。</p>}
      </div>
      {pages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {page > 1 && <a className="btn" href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}>前へ</a>}
          <span className="muted" style={{ alignSelf: "center" }}>{page} / {pages}</span>
          {page < pages && <a className="btn" href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}>次へ</a>}
        </div>
      )}
    </div>
  );
}
