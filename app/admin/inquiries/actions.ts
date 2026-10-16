"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { sendInquiryReplyEmail } from "@/lib/email";

export async function setInquiryStatus(id: string, status: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("inquiries").update({ status }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, `inquiry_status_${status}`, "inquiry", id);

  revalidatePath("/admin/inquiries");
}

/** 運営メモを保存(お客様には見えない) */
export async function saveInquiryMemo(id: string, formData: FormData) {
  const supabase = await createClient();
  const memo = String(formData.get("memo") ?? "").trim().slice(0, 2000) || null;
  const { error } = await supabase.from("inquiries").update({ admin_memo: memo }).eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminAction(supabase, "inquiry_memo", "inquiry", id);
  revalidatePath("/admin/inquiries");
}

/**
 * お問い合わせにメールで返信する(info@ から送信、返信内容は履歴に残す)。
 * 送ったら「対応中」、「返信して対応済みにする」を選んだら「対応済み」にする。
 */
export async function replyToInquiry(id: string, formData: FormData) {
  const supabase = await createClient();
  const body = String(formData.get("body") ?? "").trim();
  const finish = formData.get("finish") === "1";
  // エラーは画面の上に出す(以前はエラー画面に飛んでいた)
  const fail = (message: string): never => redirect(`/admin/inquiries?error=${encodeURIComponent(message)}#inq-${id}`);
  if (!body) fail("返信の本文を入力してください。");
  if (body.length > 5000) fail("返信の本文が長すぎます(5000文字まで)。");

  const { data: inquiry, error: readError } = await supabase
    .from("inquiries")
    .select("id, name, email, subject, message, created_at")
    .eq("id", id)
    .maybeSingle();
  if (readError || !inquiry) fail("お問い合わせが見つかりません。");
  if (!inquiry!.email) fail("このお問い合わせにはメールアドレスがありません。");

  try {
    await sendInquiryReplyEmail({
      to: inquiry!.email,
      name: inquiry!.name,
      subject: inquiry!.subject,
      body,
      original: inquiry!.message ?? "",
      receivedAt: new Date(inquiry!.created_at),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`メールを送れませんでした（宛先：${inquiry!.email}）。アドレスが正しいか確認してください。詳細：${msg.slice(0, 200)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("inquiry_replies").insert({ inquiry_id: id, body, sent_by: user?.id ?? null, sent_by_email: user?.email ?? null });
  await supabase.from("inquiries").update({ status: finish ? "done" : "in_progress" }).eq("id", id);
  await logAdminAction(supabase, "inquiry_replied", "inquiry", id, { finish });
  revalidatePath("/admin/inquiries");
  redirect(`/admin/inquiries?sent=1#inq-${id}`);
}
