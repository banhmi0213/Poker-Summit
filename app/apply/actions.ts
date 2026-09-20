"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitApplication(formData: FormData) {
  const supabase = await createClient();

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
