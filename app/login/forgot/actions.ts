"use server";

import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requestMeta } from "@/lib/login-guard";
import { sendPasswordResetEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";

// 「パスワードを忘れた方」(2026/10)。会員・運営どちらも Supabase Auth のアカウントなので共通。
// アカウントの有無が分からないよう、結果は常に「送信しました」と表示する。
// 送りすぎ防止: 同じアドレスへは1時間に3回、同じIPからは1時間に10回まで。
const PER_EMAIL_PER_HOUR = 3;
const PER_IP_PER_HOUR = 10;
const LINK_MINUTES = 60;

function emailKey(email: string) {
  return createHash("sha256").update(`reset:${email}`).digest("hex").slice(0, 32);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").normalize("NFKC").trim().toLowerCase();
  const from = String(formData.get("from") ?? "") === "admin" ? "admin" : "member";
  const back = `/login/forgot${from === "admin" ? "?from=admin&" : "?"}`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`${back}error=${encodeURIComponent("メールアドレスを正しく入力してください。")}`);
  }

  const svc = createServiceRoleClient();
  const { ip } = await requestMeta();
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const key = emailKey(email);

  const [{ count: emailCount }, ipResult] = await Promise.all([
    svc.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "password_reset_requested").eq("target_id", key).gte("created_at", since),
    ip
      ? svc.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "password_reset_requested").eq("detail->>ip", ip).gte("created_at", since)
      : Promise.resolve({ count: 0 }),
  ]);
  if ((emailCount ?? 0) >= PER_EMAIL_PER_HOUR || (ipResult.count ?? 0) >= PER_IP_PER_HOUR) {
    redirect(`${back}error=${encodeURIComponent("短時間に何度も送信されたため、受付を一時停止しています。1時間ほどしてからお試しください。")}`);
  }

  await svc.from("audit_log").insert({ actor_user_id: null, actor_email: null, action: "password_reset_requested", target_type: "auth", target_id: key, detail: { ip } });

  try {
    const { data, error } = await svc.auth.admin.generateLink({ type: "recovery", email });
    const tokenHash = data?.properties?.hashed_token;
    if (!error && tokenHash) {
      const next = from === "admin" ? "/account/password?from=admin" : "/account/password";
      const link = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=${encodeURIComponent(next)}`;
      await sendPasswordResetEmail({ to: email, link, minutes: LINK_MINUTES });
    }
    // 登録の無いアドレスは generateLink がエラーになる。画面には出さない。
  } catch (e) {
    console.error("password reset failed", e instanceof Error ? e.message : e);
  }

  redirect(`${back}sent=1`);
}
