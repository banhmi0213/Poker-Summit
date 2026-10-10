import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendBulkEmailToStores } from "./actions";

type BulkEmailResult = {
  sentCount: number;
  failedCount: number;
  failed: { to: string; error: string }[];
  lineSent?: number;
};

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

  const [{ count: lineAll }, { data: activeStores }] = await Promise.all([
    supabase.from("stores").select("id", { count: "exact", head: true }).not("line_user_id", "is", null).in("status", ["approved", "listed", "payment_suspended"]),
    supabase.from("store_contracts").select("store_id, stores(line_user_id)").eq("status", "active"),
  ]);
  const lineContracted = (activeStores ?? []).filter((c: any) => {
    const st = Array.isArray(c.stores) ? c.stores[0] : c.stores;
    return !!st?.line_user_id;
  }).length;

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
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>店舗へのお知らせ(メール・LINE)</h1>
      <p style={{ marginBottom: 16, color: "#666" }}>
        契約中(ステータス: active)の店舗のうち、連絡先メールアドレスが登録されている
        <strong> {recipientCount}件</strong> に送信されます。送信元は info@pokersummit.jp です。
      </p>

      {result && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p>
            送信完了: メール 成功 {result.sentCount}件 / 失敗 {result.failedCount}件
            {typeof result.lineSent === "number" && result.lineSent > 0 && <> ／ LINE {result.lineSent}件</>}
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
          送信する(メール {recipientCount}件)
        </button>
      </form>
    </div>
  );
}
