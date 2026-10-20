"use server";

import { authErrorMessage } from "@/lib/auth-error";

import { normalizeMHoldemId, mHoldemIdError } from "@/lib/m-holdem";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import { passwordPolicyError } from "@/lib/password-policy";
import { headers } from "next/headers";
import { verifyTurnstile, clientIpFromHeaders } from "@/lib/turnstile";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { classifyDevice, inAppBrowser } from "@/lib/device";
import { handleNameError } from "@/lib/handle-name";
import { guessPrefForSignup } from "@/lib/current-pref";

export async function signUp(formData: FormData) { return register(formData, "/signup"); }
export async function prelaunchSignUp(formData: FormData) { return register(formData, "/prelaunch"); }
// 登録で止まった理由を記録してから、エラー表示に戻す(2026/10/20、public.signup_errors。
// 「送信したのに会員ができていない」人の原因を見るため。メールアドレスはドメインだけ、パスワードは残さない)
async function fail(path: string, formData: FormData, reason: string, message: string, detail?: string): Promise<never> {
  try {
    const h = headers();
    const ua = h.get("user-agent");
    const email = String(formData.get("email") ?? "").normalize("NFKC").trim();
    await createServiceRoleClient().from("signup_errors").insert({
      path,
      reason,
      message,
      detail: detail ? detail.slice(0, 500) : null,
      email_domain: email.includes("@") ? email.split("@").pop()!.toLowerCase().slice(0, 100) : null,
      device: classifyDevice(ua),
      in_app: inAppBrowser(ua),
      user_agent: ua ? ua.slice(0, 300) : null,
    });
  } catch {
    // 記録に失敗してもエラー表示は出す
  }
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function register(formData: FormData, path: "/signup" | "/prelaunch") {
  if (formData.get("legalConsent") !== "agree") {
    await fail(path, formData, "legal_consent", "利用規約とプライバシーポリシーへの同意が必要です。");
  }
  if (formData.get("termsVersion") !== TERMS_VERSION || formData.get("privacyVersion") !== PRIVACY_VERSION) {
    await fail(path, formData, "terms_version", "規約が更新されました。ページを更新して内容をご確認ください。");
  }
  const email = String(formData.get("email") ?? "").normalize("NFKC").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const mHoldemId = normalizeMHoldemId(formData.get("mHoldemId"));
  const idError = mHoldemIdError(mHoldemId);
  if (idError) await fail(path, formData, "m_holdem_id_format", idError);
  const pref = String(formData.get("pref") ?? "").trim();
  // 都道府県の公開設定(2026/10追加)。未指定時は従来通り公開扱い。
  const prefPublic = String(formData.get("prefPublic") ?? "public").trim() !== "private";

  if (name) {
    const nameError = handleNameError(name);
    if (nameError) await fail(path, formData, "handle_name", nameError, name);
  }

  if (!email || !password) {
    await fail(path, formData, "missing_fields", "メールアドレスとパスワードを入力してください。");
  }

  const passwordError = passwordPolicyError(password);
  if (passwordError) {
    await fail(path, formData, "password_policy", passwordError!);
  }

  // ロボット対策(Cloudflare Turnstile)
  const h = headers();
  const ip = clientIpFromHeaders(h);
  const token = String(formData.get("cf-turnstile-response") ?? "") || null;
  if (!(await verifyTurnstile(token, ip))) {
    await fail(path, formData, "turnstile", "ロボットでないことの確認ができませんでした。もう一度お試しください。", token ? "verify_failed" : "token_missing");
  }

  // 1つの m HOLD'EM ID は1アカウントだけ(2026/10/19)
  if (mHoldemId) {
    const { data: taken } = await createServiceRoleClient().rpc("m_holdem_id_taken", { p_id: mHoldemId });
    if (taken === true) {
      await fail(path, formData, "m_holdem_id_taken", "このm HOLD’EM IDはすでに別のアカウントで登録されています。ご自身のIDの場合は、IDを空欄にして登録したあとお問い合わせください。");
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { m_holdem_id: mHoldemId || null, display_name: name || undefined, pref: pref || undefined, pref_public: prefPublic, legal_consent: true, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION },
    },
  });

  if (error) {
    await fail(path, formData, "auth_signup", authErrorMessage(error.message), error.message);
  }

  // 登録時のIPアドレスを記録(重複登録の見回り用。新規登録のときだけ)
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    try {
      // 登録画面で都道府県を聞かないかわりに、だいたいの都道府県を記録(集計用、2026/10/20)
      const guessed = await guessPrefForSignup().catch(() => ({ pref: null, source: null }));
      await createServiceRoleClient()
        .from("member_signup_logs")
        .upsert(
          { user_id: data.user.id, ip, user_agent: (h.get("user-agent") ?? "").slice(0, 300) || null, guessed_pref: guessed.pref, guessed_pref_source: guessed.source },
          { onConflict: "user_id", ignoreDuplicates: true }
        );
    } catch {
      // 記録の失敗で登録は止めない
    }
  }

  // すでに登録済みのアドレスで登録しようとした場合、Supabaseは(なりすまし防止のため)成功に見せかけて何も作らない。
  // 本人には「確認メールを送りました」と出るが会員は増えないので、記録だけ残す(2026/10/20)
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    try {
      const ua = h.get("user-agent");
      await createServiceRoleClient().from("signup_errors").insert({
        path,
        reason: "already_registered",
        message: "登録済みのメールアドレス(確認メールの再送扱い)",
        email_domain: email.includes("@") ? email.split("@").pop()!.toLowerCase().slice(0, 100) : null,
        device: classifyDevice(ua),
        in_app: inAppBrowser(ua),
        user_agent: ua ? ua.slice(0, 300) : null,
      });
    } catch {
      // 記録の失敗で止めない
    }
  }

  if (data.session) {
    redirect("/mypage");
  }

  redirect(`${path}?done=1`);
}
