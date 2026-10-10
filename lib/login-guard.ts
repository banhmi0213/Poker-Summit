import "server-only";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { clientIpFromHeaders } from "@/lib/turnstile";

// ログインの不正対策(クレジットカード・セキュリティガイドライン/日本クレジット協会の
// 不正ログイン対策に対応)。
// - 同じアカウントへのログイン失敗が MAX_FAILURES 回に達したら LOCK_MINUTES 分ロック
// - 同じIPアドレスからの失敗が MAX_IP_FAILURES 回に達したら、そのIPからのログインを一時停止
// - 記録は audit_log(action: login_failed / login_succeeded / login_locked)に残す
//   アカウントはログインID・メールアドレスそのものではなくハッシュで持つ

export type LoginKind = "store" | "admin" | "member";

export const MAX_FAILURES = 10;
export const MAX_IP_FAILURES = 50;
export const LOCK_MINUTES = 30;

function accountKey(kind: LoginKind, identifier: string) {
  return createHash("sha256").update(`${kind}:${identifier.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

export async function requestMeta() {
  const h = await headers();
  return { ip: clientIpFromHeaders(h), userAgent: h.get("user-agent") };
}

/** ロック中なら、画面に出すメッセージを返す。ロックされていなければ null。 */
export async function loginLockMessage(kind: LoginKind, identifier: string, ip: string | null): Promise<string | null> {
  const svc = createServiceRoleClient();
  const key = accountKey(kind, identifier);
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();

  // 最後に成功したログイン以降の失敗だけを数える
  const { data: lastOk } = await svc
    .from("audit_log")
    .select("created_at")
    .eq("action", "login_succeeded")
    .eq("target_type", kind)
    .eq("target_id", key)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const from = lastOk?.created_at && lastOk.created_at > since ? lastOk.created_at : since;

  const [{ count: accountFails }, ipResult] = await Promise.all([
    svc
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "login_failed")
      .eq("target_type", kind)
      .eq("target_id", key)
      .gt("created_at", from),
    ip
      ? svc
          .from("audit_log")
          .select("id", { count: "exact", head: true })
          .eq("action", "login_failed")
          .eq("detail->>ip", ip)
          .gt("created_at", since)
      : Promise.resolve({ count: 0 }),
  ]);

  if ((accountFails ?? 0) >= MAX_FAILURES || (ipResult.count ?? 0) >= MAX_IP_FAILURES) {
    return `ログインに続けて失敗したため、安全のため一時的にログインを制限しています。${LOCK_MINUTES}分ほど時間をおいてからお試しください。パスワードがわからない場合は、お問い合わせフォームからご連絡ください。`;
  }
  return null;
}

async function record(action: string, kind: LoginKind, identifier: string, detail: Record<string, unknown>, userId?: string | null) {
  try {
    await createServiceRoleClient()
      .from("audit_log")
      .insert({ actor_user_id: userId ?? null, actor_email: null, action, target_type: kind, target_id: accountKey(kind, identifier), detail });
  } catch {
    // 記録に失敗してもログイン自体は止めない
  }
}

export async function recordLoginFailure(kind: LoginKind, identifier: string, meta: { ip: string | null; userAgent: string | null }) {
  await record("login_failed", kind, identifier, { ip: meta.ip, ua: meta.userAgent?.slice(0, 200) ?? null });
}

export async function recordLoginLocked(kind: LoginKind, identifier: string, meta: { ip: string | null; userAgent: string | null }) {
  await record("login_locked", kind, identifier, { ip: meta.ip, ua: meta.userAgent?.slice(0, 200) ?? null });
}

export async function recordLoginSuccess(kind: LoginKind, identifier: string, meta: { ip: string | null; userAgent: string | null }, userId: string | null) {
  await record("login_succeeded", kind, identifier, { ip: meta.ip, ua: meta.userAgent?.slice(0, 200) ?? null }, userId);
}
