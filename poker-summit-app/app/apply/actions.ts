"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitApplication(formData: FormData) {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("site_settings")
    .select("listing_accept_new")
    .eq("id", true)
    .maybeSingle();

  if (settings && settings.listing_accept_new === false) {
    redirect(
      `/apply?error=${encodeURIComponent(
        "現在、新規の掲載申込の受付を停止しております。"
      )}`
    );
  }

  const companyName = String(formData.get("companyName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const tel = String(formData.get("tel") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!companyName || !contactName || !email) {
    redirect(
      `/apply?error=${encodeURIComponent(
        "会社名・屋号、担当者名、メールアドレスは必須です。"
      )}`
    );
  }

  const { error } = await supabase.from("listing_applications").insert({
    company_name: companyName,
    contact_name: contactName,
    tel: tel || null,
    email,
    pref: pref || null,
    category: category || null,
    message: message || null,
  });

  if (error) {
    redirect(`/apply?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/apply?done=1");
}
