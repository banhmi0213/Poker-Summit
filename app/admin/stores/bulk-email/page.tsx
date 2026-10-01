import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendBulkEmailToStores } from "./actions";

type BulkEmailResult = {
  sentCount: number;
  failedCount: number;
  failed: { to: string; error: string }[];
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
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>店舗への一斉メール</h1>
      <p style={{ marginBottom: 16, color: "#666" }}>
        契約中(ステータス: active)の店舗のうち、連絡先メールアドレスが登録されている
        <strong> {recipientCount}件</strong> に送信されます。送信元は info@pokersummit.jp です。
      </p>

      {result && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p>
            送信完了: 成功 {result.sentCount}件 / 失敗 {result.failedCount}件
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
        <button type="submit" className="btn">
          {recipientCount}件に送信する
        </button>
      </form>
    </div>
  );
}
