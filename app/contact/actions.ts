"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  redirect("/contact?done=1");
}
