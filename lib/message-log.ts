import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// サイトから送ったメール・LINEの記録(public.message_log、2026/10/20)。
// 宛先・件名・本文・結果を残す。パスワード・確認コード・ログイン情報を含むものは本文を残さない。
// 記録に失敗しても送信の処理は止めない。
export async function logMessage(entry: {
  channel: "email" | "line";
  to: string;
  subject?: string | null;
  body?: string | null;
  sensitive?: boolean;
  hasAttachment?: boolean;
  status: "sent" | "failed" | "skipped";
  error?: string | null;
  providerId?: string | null;
  storeId?: string | null;
}): Promise<void> {
  try {
    await createServiceRoleClient()
      .from("message_log")
      .insert({
        channel: entry.channel,
        to_address: entry.to,
        store_id: entry.storeId ?? null,
        subject: entry.subject ?? null,
        body: entry.sensitive ? null : (entry.body ?? null)?.slice(0, 20000) ?? null,
        sensitive: !!entry.sensitive,
        has_attachment: !!entry.hasAttachment,
        status: entry.status,
        error: entry.error ? entry.error.slice(0, 1000) : null,
        provider_id: entry.providerId ?? null,
      });
  } catch (e) {
    console.error("[message-log] failed", e);
  }
}
