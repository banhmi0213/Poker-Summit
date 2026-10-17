"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendInquiryNotificationEmail } from "@/lib/email";
import { guardPublicForm } from "@/lib/form-guard";

export async function submitInquiry(formData: FormData) {
  const supabase = await createClient();
  const advertising = formData.get("inquiry_type") === "advertising";
  const company = String(formData.get("company") ?? "").trim().slice(0, 200);
  const returnPath = advertising ? "/contact?category=advertising&" : "/contact?";

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").normalize("NFKC").trim();
  const tel = String(formData.get("tel") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("message") ?? "").trim();
  const message = advertising ? `会社名・店舗名: ${company}\n\n${body}` : body;
  const category = String(formData.get("category") ?? "").trim();

  if (!name || !email || !body || (advertising && !company)) {
    redirect(returnPath + "error=" + encodeURIComponent("必須項目を入力してください。"));
  }

  // ロボット対策と回数制限(同じ回線から1時間に5回まで)
  const blocked = await guardPublicForm(formData, "inquiry", 5);
  if (blocked) redirect(returnPath + "error=" + encodeURIComponent(blocked));

  const { error } = await supabase.from("inquiries").insert({
    name,
    email,
    tel: tel || null,
    subject: subject || null,
    message,
    category: category || null,
  });

  if (error) {
    redirect(returnPath + "error=" + encodeURIComponent(error.message));
  }

  // 運営への通知メール(2026/10、「問い合わせ、掲載申込があったらメール
  // 届くように設定しておいて」との指示を受けて追加)。site_settingsの
  // notify_inquiryがONかつnotify_emailが設定されているときだけ送る。
  // ベストエフォート:失敗しても問い合わせ受付自体は止めない。
  try {
    const { data: settings } = await supabase
      .from("site_settings")
      .select("notify_email, notify_inquiry")
      .eq("id", true)
      .maybeSingle();

    if (settings?.notify_inquiry && settings.notify_email) {
      await sendInquiryNotificationEmail({
        to: settings.notify_email,
        name,
        email,
        tel,
        subject,
        category,
        message,
      });
    }
  } catch {
    // ベストエフォート: 通知失敗で問い合わせ受付自体は止めない
  }

  redirect(returnPath + "done=1");
}
