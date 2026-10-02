"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendInquiryNotificationEmail } from "@/lib/email";

export async function submitInquiry(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const tel = String(formData.get("tel") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!name || !email || !message) {
    redirect("/contact?error=" + encodeURIComponent("必須項目を入力してください。"));
  }

  const { error } = await supabase.from("inquiries").insert({
    name,
    email,
    tel: tel || null,
    subject: subject || null,
    message,
    category: category || null,
  });

  if (error) {
    redirect("/contact?error=" + encodeURIComponent(error.message));
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

  redirect("/contact?done=1");
}
