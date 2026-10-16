import "server-only";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyTurnstile, clientIpFromHeaders } from "@/lib/turnstile";

// 誰でも送れるフォーム(お問い合わせ・掲載申込み)のロボット対策と回数制限(2026/10)。
// - Cloudflare Turnstile の確認(会員登録と同じ。キー未設定の環境では省略)
// - 同じ回線(IP)から1時間に perIpPerHour 回まで。記録は audit_log(action=form_<名前>)
// 問題があればお客様向けのエラー文を返し、なければ null を返す(このとき送信を1回として記録する)。
export async function guardPublicForm(formData: FormData, name: string, perIpPerHour: number): Promise<string | null> {
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  const token = String(formData.get("cf-turnstile-response") ?? "") || null;
  if (!(await verifyTurnstile(token, ip))) {
    return "ロボットでないことの確認ができませんでした。チェックが表示されている場合は押してから、もう一度送信してください。";
  }
  if (!ip) return null;
  const svc = createServiceRoleClient();
  const action = `form_${name}`;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await svc
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", action)
    .eq("detail->>ip", ip)
    .gte("created_at", since);
  if ((count ?? 0) >= perIpPerHour) {
    return "短時間に何度も送信されたため、受付を一時停止しています。1時間ほどしてからお試しください。お急ぎの場合は info@pokersummit.jp までメールでご連絡ください。";
  }
  await svc.from("audit_log").insert({ actor_user_id: null, actor_email: null, action, target_type: "form", target_id: null, detail: { ip } });
  return null;
}
