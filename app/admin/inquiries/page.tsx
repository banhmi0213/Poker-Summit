import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { setInquiryStatus, saveInquiryMemo, replyToInquiry } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  unread: "未読",
  in_progress: "対応中",
  done: "対応済み",
};
const STATUS_COLOR: Record<string, string> = { unread: "#aa3b28", in_progress: "#b7791f", done: "#6b7280" };

function formatDate(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TABS = [
  { key: "open", label: "未対応（未読・対応中）" },
  { key: "unread", label: "未読" },
  { key: "in_progress", label: "対応中" },
  { key: "done", label: "対応済み" },
  { key: "all", label: "すべて" },
];

// お問い合わせ管理(2026/10 作り直し)。この画面からメールで返信でき、返信の履歴と運営メモが残る。
// 「対応中」=返信したがまだやり取りが続くもの、「対応済み」=やり取りが終わったもの。
export default async function AdminInquiriesPage({ searchParams }: { searchParams: { tab?: string; error?: string; sent?: string } }) {
  const supabase = await createClient();
  const tab = TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab! : "open";

  let query = supabase.from("inquiries").select("*").order("created_at", { ascending: false });
  if (tab === "open") query = query.in("status", ["unread", "in_progress"]);
  else if (tab !== "all") query = query.eq("status", tab);
  const { data: inquiries } = await query;

  const ids = (inquiries ?? []).map((i) => i.id);
  const { data: replies } = ids.length
    ? await supabase.from("inquiry_replies").select("inquiry_id, body, sent_by_email, sent_at").in("inquiry_id", ids).order("sent_at")
    : { data: [] as any[] };
  const repliesBy = new Map<string, any[]>();
  for (const r of replies ?? []) repliesBy.set(r.inquiry_id, [...(repliesBy.get(r.inquiry_id) ?? []), r]);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>お問い合わせ管理</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        下の欄に書いて「返信する」を押すと、お客様にメールで届きます（送信元 info@pokersummit.jp。お客様からの返信は info@ に届きます）。
        やり取りが終わったら「対応済み」に。営業メールなど返信不要なものは、そのまま「対応済みにする」を押してください。
      </p>

      {searchParams.error && <p className="err" style={{ marginBottom: 12 }}>{searchParams.error}</p>}
      {searchParams.sent && <p style={{ marginBottom: 12, color: "#1f7a3a", fontWeight: 700 }}>返信メールを送りました。</p>}

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/inquiries?tab=${t.key}`} className={`btn ${tab === t.key ? "primary" : ""}`} style={{ fontSize: 12.5 }}>
            {t.label}
          </Link>
        ))}
      </div>

      {(!inquiries || inquiries.length === 0) && <p className="muted">該当するお問い合わせはありません。</p>}

      {inquiries?.map((i) => {
        const history = repliesBy.get(i.id) ?? [];
        return (
          <div className="card" key={i.id} id={`inq-${i.id}`} style={{ display: "grid", gap: 10, scrollMarginTop: 80 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0 }}>{i.subject || "（件名なし）"}</h3>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {i.category && <span className="badge" style={{ marginRight: 6 }}>{i.category}</span>}
                  {formatDate(i.created_at)}
                </div>
              </div>
              <span
                style={{ background: STATUS_COLOR[i.status] ?? "#6b7280", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}
              >
                {STATUS_LABEL[i.status] ?? i.status}
              </span>
            </div>

            <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
              <div>お名前：{i.name || "（未入力）"}</div>
              <div>
                メール：{i.email ? <a href={`mailto:${i.email}`}>{i.email}</a> : "（未入力）"}
              </div>
              {i.tel && (
                <div>
                  電話：<a href={`tel:${i.tel}`}>{i.tel}</a>
                </div>
              )}
            </div>

            <div style={{ background: "#faf6ec", borderRadius: 8, padding: "10px 12px", whiteSpace: "pre-wrap", fontSize: 14 }}>{i.message}</div>

            {history.length > 0 && (
              <div style={{ display: "grid", gap: 6 }}>
                <strong style={{ fontSize: 13 }}>返信の履歴</strong>
                {history.map((h, idx) => (
                  <div key={idx} style={{ borderLeft: "3px solid #c9a24b", padding: "4px 10px", fontSize: 13.5 }}>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {formatDate(h.sent_at)}・{h.sent_by_email ?? "運営"} が送信
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{h.body}</div>
                  </div>
                ))}
              </div>
            )}

            {i.email && (
              <form action={replyToInquiry.bind(null, i.id)} style={{ display: "grid", gap: 6 }}>
                <input type="hidden" name="tab" value={tab} />
                <textarea
                  name="body"
                  rows={5}
                  required
                  maxLength={5000}
                  placeholder={`${i.name ? `${i.name} 様` : "お客様"}への返信を書く（宛名・署名・元のお問い合わせ内容は自動で付きます）`}
                  style={{ fontSize: 14 }}
                />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="submit" name="finish" value="0" className="btn primary" style={{ fontSize: 12.5 }}>
                    返信する
                  </button>
                  <button type="submit" name="finish" value="1" className="btn" style={{ fontSize: 12.5 }}>
                    返信して対応済みにする
                  </button>
                </div>
              </form>
            )}

            <form action={saveInquiryMemo.bind(null, i.id)} style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
              <textarea
                name="memo"
                defaultValue={i.admin_memo ?? ""}
                rows={2}
                placeholder="運営メモ（電話で対応した内容など。お客様には見えません）"
                style={{ flex: "1 1 320px", fontSize: 13 }}
                data-no-draft
              />
              <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                メモを保存
              </button>
            </form>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid #eee", paddingTop: 10 }}>
              {i.status !== "in_progress" && (
                <form action={setInquiryStatus.bind(null, i.id, "in_progress")}>
                  <button type="submit" className="btn" style={{ fontSize: 12.5 }}>対応中にする</button>
                </form>
              )}
              {i.status !== "done" && (
                <form action={setInquiryStatus.bind(null, i.id, "done")}>
                  <button type="submit" className="btn primary" style={{ fontSize: 12.5 }}>対応済みにする</button>
                </form>
              )}
              {i.status !== "unread" && (
                <form action={setInquiryStatus.bind(null, i.id, "unread")}>
                  <button type="submit" className="btn" style={{ fontSize: 12.5 }}>未読に戻す</button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
