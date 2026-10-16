import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { MarkMessagesRead } from "./mark-read";

export const dynamic = "force-dynamic";

// 運営からのお知らせ(受信箱、2026/10)。総合管理の「お知らせ(メール・LINE)」で送った内容がここにも残る。
// 開いた時点で全部既読にする(メニューの赤い件数の印が消える)。
export default async function StoreMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/store/login?next=/store/profile/messages");

  const { data: store } = await supabase.from("stores").select("id, name").eq("owner_user_id", user.id).maybeSingle();
  if (!store) {
    return (
      <div className="container">
        <p className="err">このアカウントに紐づく店舗が見つかりません。運営に店舗オーナーとしての登録を依頼してください。</p>
      </div>
    );
  }

  const { data: messages } = await supabase
    .from("store_messages")
    .select("id, title, body, created_at, read_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const hadUnread = (messages ?? []).some((m) => !m.read_at);
  if (hadUnread) await supabase.rpc("mark_store_messages_read", { p_store_id: store.id });

  return (
    <div>
      {hadUnread && <MarkMessagesRead />}
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>運営からのお知らせ</h1>
      <p className="muted" style={{ marginBottom: 16 }}>Poker Summit運営からのお知らせです。メール・LINEでお送りした内容もここで確認できます。</p>
      {(messages ?? []).length === 0 ? (
        <div className="card">
          <p className="muted">まだお知らせはありません。</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {(messages ?? []).map((m) => (
            <article key={m.id} className="card">
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", marginBottom: 6 }}>
                {!m.read_at && (
                  <span style={{ background: "#aa3b28", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "1px 8px" }}>NEW</span>
                )}
                <h2 style={{ fontSize: 16, margin: 0 }}>{m.title}</h2>
                <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>
                  {new Date(m.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.8, fontSize: 14 }}>{m.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
