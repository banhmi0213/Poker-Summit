import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendAdminAlertEmail } from "@/lib/email";

/**
 * 運営にメールで知らせる(決済の結果不明・自動処理の失敗など)。
 * 送り先は総合管理の「通知先メールアドレス」(site_settings.notify_email)。
 * 失敗しても例外は投げない(呼び出し元の処理は止めない)。送れなかったことは audit_log に残す。
 */
export async function alertAdmin(subject: string, lines: string[], link?: string): Promise<boolean> {
  const svc = createServiceRoleClient();
  try {
    const { data } = await svc.from("site_settings").select("notify_email").eq("id", true).maybeSingle();
    const to = (data?.notify_email as string | null) ?? null;
    if (!to) throw new Error("通知先メールアドレス(notify_email)が未設定です。");
    await sendAdminAlertEmail({ to, subject, lines, link });
    return true;
  } catch (e) {
    console.error("[admin-alert] failed", subject, e);
    await svc
      .from("audit_log")
      .insert({ action: "admin_alert_failed", target_type: "system", detail: { subject, lines, error: e instanceof Error ? e.message : String(e) } })
      .then(() => undefined, () => undefined);
    return false;
  }
}
