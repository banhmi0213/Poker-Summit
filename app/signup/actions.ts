"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import { passwordPolicyError } from "@/lib/password-policy";

export async function signUp(formData: FormData) {
  if (formData.get("legalConsent") !== "agree") {
    redirect(`/signup?error=${encodeURIComponent("利用規約とプライバシーポリシーへの同意が必要です。")}`);
  }
  if (formData.get("termsVersion") !== TERMS_VERSION || formData.get("privacyVersion") !== PRIVACY_VERSION) {
    redirect(`/signup?error=${encodeURIComponent("規約が更新されました。ページを更新して内容をご確認ください。")}`);
  }
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();
  // 都道府県の公開設定(2026/10追加)。未指定時は従来通り公開扱い。
  const prefPublic = String(formData.get("prefPublic") ?? "public").trim() !== "private";

  if (!email || !password) {
    redirect(`/signup?error=${encodeURIComponent("メールアドレスとパスワードを入力してください。")}`);
  }

  const passwordError = passwordPolicyError(password);
  if (passwordError) {
    redirect(`/signup?error=${encodeURIComponent(passwordError)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name || undefined, pref: pref || undefined, pref_public: prefPublic, legal_consent: true, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (data.session) {
    redirect("/mypage");
  }

  redirect("/signup?done=1");
}
