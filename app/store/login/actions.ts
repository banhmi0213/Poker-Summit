"use server";

import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { STORE_LOGIN_ID_DOMAIN } from "@/lib/constants";
import { loginLockMessage, recordLoginFailure, recordLoginLocked, recordLoginSuccess, requestMeta } from "@/lib/login-guard";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendLoginNotificationEmail } from "@/lib/email";

// 店舗管理専用のログイン処理。ログインID("store-xxxxxxxx"形式・@を含まない)
// を、発行時(lib/store-provision.ts の system_issue_store_login() /
// app/admin/stores/actions.ts の admin_issue_store_login())と同じ規則で
// Supabase Auth上の実メールアドレス("loginId@login.poker-summit.jp")に
// 変換してからサインインする。DB側はloginIdをlower(trim())してから
// メールアドレスを組み立てて登録しているため、ここでも同じ正規化をする。
export async function storeSignIn(formData: FormData) {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!loginId) {
    redirect(
      `/store/login?error=${encodeURIComponent("ログインIDを入力してください。")}&next=${encodeURIComponent(next)}`
    );
  }

  const email = `${loginId.toLowerCase()}@${STORE_LOGIN_ID_DOMAIN}`;

  // 不正ログイン対策: 続けて失敗しているアカウント・IPはしばらくロックする(lib/login-guard.ts)
  const meta = await requestMeta();
  const lockMessage = await loginLockMessage("store", loginId, meta.ip);
  if (lockMessage) {
    await recordLoginLocked("store", loginId, meta);
    redirect(`/store/login?error=${encodeURIComponent(lockMessage)}&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await recordLoginFailure("store", loginId, meta);
    redirect(
      `/store/login?error=${encodeURIComponent("ログインIDまたはパスワードが正しくありません。")}&next=${encodeURIComponent(next)}`
    );
  }

  await recordLoginSuccess("store", loginId, meta, data.user?.id ?? null);
  // ログインがあったことを契約の連絡先メールへ通知(心当たりのないログインに気づけるように)
  try {
    const svc = createServiceRoleClient();
    const { data: store } = await svc
      .from("stores")
      .select("name, store_contracts(contact_email, status)")
      .eq("owner_user_id", data.user!.id)
      .maybeSingle();
    const contracts = ((store as any)?.store_contracts ?? []) as { contact_email: string | null; status: string }[];
    const to = contracts.find((c) => c.status === "active" && c.contact_email)?.contact_email ?? contracts.find((c) => c.contact_email)?.contact_email;
    if (to) {
      await sendLoginNotificationEmail({ to, accountLabel: `店舗管理画面（${(store as any)?.name ?? "店舗"}）`, at: new Date(), ip: meta.ip, userAgent: meta.userAgent });
    }
  } catch {
    // 通知に失敗してもログインは続ける
  }

  redirect(next || "/store/profile");
}

export async function storeSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/store/login");
}
