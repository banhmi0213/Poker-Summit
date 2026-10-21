import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendBulkEmailToStores, setSiteNoticePublished, deleteSiteNotice } from "./actions";
import { getSalesRecipients, sendSalesEmail, optOutSalesEmail } from "./sales-actions";
import { ConfirmButton } from "@/app/store/(authenticated)/profile/confirm-button";

type BulkEmailResult = {
  sentCount: number;
  failedCount: number;
  failed: { to: string; error: string }[];
  lineSent?: number;
  toEmail?: boolean;
  siteNotice?: boolean;
  memberSent?: number;
  memberFailedCount?: number;
};

// 営業メールは1通ずつ間隔をあけて送るので時間がかかる
export const maxDuration = 300;

export default async function AdminBulkEmailPage() {
  const supabase = await createClient();

  const { data: contracts } = await supabase
    .from("store_contracts")
    .select("contact_email")
    .eq("status", "active")
    .not("contact_email", "is", null);

  const recipientCount = new Set(
    (contracts ?? [])
      .map((c) => c.contact_email?.trim())
      .filter((email): email is string => !!email)
  ).size;

  const [{ count: lineAll }, { data: activeStores }, { data: siteNotices }] = await Promise.all([
    supabase.from("stores").select("id", { count: "exact", head: true }).not("line_user_id", "is", null).in("status", ["approved", "listed", "payment_suspended"]),
    supabase.from("store_contracts").select("store_id, stores(line_user_id)").eq("status", "active"),
    supabase.from("site_notices").select("id, title, body, published, created_at").order("created_at", { ascending: false }).limit(30),
  ]);
  const lineContracted = (activeStores ?? []).filter((c: any) => {
    const st = Array.isArray(c.stores) ? c.stores[0] : c.stores;
    return !!st?.line_user_id;
  }).length;

  const { data: memberRows } = await createServiceRoleClient().rpc("member_notice_recipients");
  // 送信の記録(宛先の一覧つき、2026/10/20)
  const { data: historyRows } = await supabase
    .from("audit_log")
    .select("id, created_at, detail")
    .eq("action", "store_bulk_email_sent")
    .order("created_at", { ascending: false })
    .limit(20);
  const memberCount = (memberRows ?? []).length;
  const salesRecipients = await getSalesRecipients();
  const { data: salesExcluded } = await createServiceRoleClient()
    .from("sales_contact_import")
    .select("name, email, excluded_reason")
    .eq("excluded", true)
    .order("id");

  const jar = await cookies();
  const resultRaw = jar.get("bulk_email_result")?.value;
  let result: BulkEmailResult | null = null;
  if (resultRaw) {
    try {
      result = JSON.parse(resultRaw);
    } catch {
      result = null;
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>お知らせ(メール・LINE・サイト)</h1>
      <p style={{ marginBottom: 16, color: "#666" }}>
        メールは、契約中(ステータス: active)の店舗のうち、連絡先メールアドレスが登録されている
        <strong> {recipientCount}件</strong> に送信されます。送信元は info@pokersummit.jp です。
        サイトに載せると、公開サイトの「お知らせ」に全国・全員向けで表示されます。
      </p>

      {result && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p>
            完了:
            {result.toEmail !== false && <> メール 成功 {result.sentCount}件 / 失敗 {result.failedCount}件</>}
            {typeof result.lineSent === "number" && result.lineSent > 0 && <> ／ LINE {result.lineSent}件</>}
            {result.siteNotice && <> ／ サイトのお知らせに掲載しました</>}
            {typeof result.memberSent === "number" && <> ／ 会員へのメール 成功 {result.memberSent}件{result.memberFailedCount ? ` / 失敗 ${result.memberFailedCount}件` : ""}</>}
          </p>
          {result.failed.length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {result.failed.map((f) => (
                <li key={f.to}>
                  {f.to}: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form
        action={sendBulkEmailToStores}
        className="card"
        style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}
      >
        <label>
          件名
          <input type="text" name="subject" required style={{ width: "100%", marginTop: 4 }} />
        </label>
        <label>
          本文
          <textarea name="body" required rows={12} style={{ width: "100%", marginTop: 4 }} />
        </label>
        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
          <legend style={{ fontSize: 13, padding: "0 4px" }}>メール・サイト</legend>
          <label style={{ display: "block", fontSize: 13.5 }}>
            <input type="checkbox" name="toEmail" defaultChecked /> 店舗にメールで送る({recipientCount}件・店舗管理画面の「運営からのお知らせ」にも残ります)
          </label>
          <label style={{ display: "block", fontSize: 13.5 }}>
            <input type="checkbox" name="toSite" /> サイトのお知らせに載せる(公開サイトの「お知らせ」に全国・全員向けで表示)
          </label>
          <label style={{ display: "block", fontSize: 13.5 }}>
            <input type="checkbox" name="toMembers" /> 会員にメールで送る({memberCount}人・メール確認済みの会員。大事なお知らせのときだけ)
          </label>
        </fieldset>
        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
          <legend style={{ fontSize: 13, padding: "0 4px" }}>LINEでも送る(LINE連携済みの店舗)</legend>
          <label style={{ display: "block", fontSize: 13.5 }}>
            <input type="radio" name="lineScope" value="contracted" defaultChecked /> 契約中の店舗に送る({lineContracted}件)
          </label>
          <label style={{ display: "block", fontSize: 13.5 }}>
            <input type="radio" name="lineScope" value="all" /> 掲載中の全店舗に送る({lineAll ?? 0}件)
          </label>
          <label style={{ display: "block", fontSize: 13.5 }}>
            <input type="radio" name="lineScope" value="none" /> LINEでは送らない
          </label>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>LINEには件名と本文をそのまま送ります(長い場合は途中で切れます)。</p>
        </fieldset>
        <button type="submit" className="btn">
          送信・掲載する
        </button>
      </form>

      <h2 style={{ fontSize: 17, margin: "28px 0 10px" }}>営業メール（掲載店・未契約）</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10, maxWidth: 640 }}>
        運営が集めた店舗の公開アドレスに送ります。同じアドレスのチェーン店は1通にまとめ、除外した店・配信停止の店・契約中の店・送信済みのアドレスには送りません。
        本文には送信者名・住所・配信停止の方法を必ず入れてください。
      </p>
      <form action={sendSalesEmail} className="card" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
        <label>
          件名
          <input type="text" name="subject" required style={{ width: "100%", marginTop: 4 }} />
        </label>
        <label>
          本文
          <textarea name="body" required rows={16} style={{ width: "100%", marginTop: 4 }} />
        </label>
        <details style={{ fontSize: 12.5 }}>
          <summary style={{ cursor: "pointer" }}>送信先 {salesRecipients.length}件を見る</summary>
          <p style={{ marginTop: 6, lineHeight: 1.8 }}>{salesRecipients.join("、") || "なし"}</p>
        </details>
        <details style={{ fontSize: 12.5 }}>
          <summary style={{ cursor: "pointer" }}>除外している店 {(salesExcluded ?? []).length}件を見る</summary>
          <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.8 }}>
            {(salesExcluded ?? []).map((r: any, i: number) => (
              <li key={i}>{r.name}（{r.email}）：{r.excluded_reason ?? "除外"}</li>
            ))}
          </ul>
        </details>
        <ConfirmButton className="btn" message={`営業メールを${salesRecipients.length}件に送信します。送信後は取り消せません。よろしいですか？`}>
          営業メールを送信する（{salesRecipients.length}件）
        </ConfirmButton>
      </form>
      <form action={optOutSalesEmail} className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", maxWidth: 640, marginTop: 10 }}>
        <span style={{ fontSize: 13 }}>配信停止の連絡があったアドレス</span>
        <input type="email" name="email" required placeholder="info@example.com" style={{ flex: 1, minWidth: 200 }} />
        <button type="submit" className="btn">配信停止にする</button>
      </form>

      <h2 style={{ fontSize: 17, margin: "28px 0 10px" }}>送信の記録</h2>
      {(historyRows ?? []).length === 0 ? (
        <p className="muted">まだ記録はありません。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640 }}>
          {(historyRows ?? []).map((h: any) => {
            const d = (h.detail ?? {}) as Record<string, any>;
            const members: string[] = Array.isArray(d.memberRecipients) ? d.memberRecipients : [];
            const stores: string[] = Array.isArray(d.storeEmailRecipients) ? d.storeEmailRecipients : [];
            const failed = [...(Array.isArray(d.failed) ? d.failed : []), ...(Array.isArray(d.memberFailed) ? d.memberFailed : [])] as { to: string; error: string }[];
            const hasList = Array.isArray(d.memberRecipients) || Array.isArray(d.storeEmailRecipients);
            return (
              <details key={h.id} className="card" style={{ padding: "10px 14px" }}>
                <summary style={{ cursor: "pointer", fontSize: 13.5 }}>
                  <strong>{d.subject ?? "(件名なし)"}</strong>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    {new Date(h.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                    {d.toMembers ? `・会員メール ${d.memberSent ?? 0}件` : ""}
                    {d.kind === "sales" ? "・営業メール" : ""}
                    {d.toEmail !== false ? `・店舗メール ${d.sentCount ?? 0}件` : ""}
                    {d.lineSent ? `・LINE ${d.lineSent}件` : ""}
                    {d.siteNotice ? "・サイト掲載" : ""}
                  </span>
                </summary>
                <div style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.8 }}>
                  {!hasList && <p className="muted">この送信は宛先の一覧を残す前のものです（件数のみ）。</p>}
                  {members.length > 0 && (<p><strong>会員：</strong>{members.join("、")}</p>)}
                  {stores.length > 0 && (<p><strong>店舗：</strong>{stores.join("、")}</p>)}
                  {failed.length > 0 && (<p style={{ color: "#d1453b" }}><strong>失敗：</strong>{failed.map((f) => `${f.to}（${f.error}）`).join("、")}</p>)}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <h2 style={{ fontSize: 17, margin: "28px 0 10px" }}>サイトのお知らせ</h2>
      {(siteNotices ?? []).length === 0 ? (
        <p className="muted">まだサイトのお知らせはありません。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
          {(siteNotices ?? []).map((n) => (
            <div key={n.id} className="card" style={{ opacity: n.published ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <span className="badge" style={{ marginRight: 6 }}>{n.published ? "掲載中" : "非公開"}</span>
                  <strong>{n.title}</strong>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {new Date(n.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <form action={setSiteNoticePublished}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="published" value={n.published ? "false" : "true"} />
                    <button type="submit" className="btn">{n.published ? "非公開にする" : "公開する"}</button>
                  </form>
                  <form action={deleteSiteNotice}>
                    <input type="hidden" name="id" value={n.id} />
                    <ConfirmButton className="btn" message={`「${n.title}」を削除します。元に戻せません。よろしいですか？`}>削除</ConfirmButton>
                  </form>
                </div>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
