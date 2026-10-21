"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAdminAction } from "@/lib/audit";
import { sendBulkEmail } from "@/lib/email";

// 営業メール(2026/10/22 オーナー指示)。
// 宛先は運営が集めた店舗連絡先(sales_contact_import)。公開されているアドレスだけ。
// 除外した行・配信停止の店・契約中の店・送信済みのアドレスには送らない。チェーン共通アドレスは1通にまとめる。
export async function getSalesRecipients() {
  const svc = createServiceRoleClient();
  const [{ data: rows, error }, { data: optOut }, { data: active }] = await Promise.all([
    svc.from("sales_contact_import").select("email, matched_store_id, excluded, sent_at"),
    svc.from("stores").select("id").eq("sales_email_opt_out", true),
    svc.from("store_contracts").select("store_id").eq("status", "active"),
  ]);
  if (error) throw new Error(error.message);
  const blockedStores = new Set([...(optOut ?? []).map((s) => s.id as string), ...(active ?? []).map((c) => c.store_id as string)]);
  // 同じアドレスの行が1つでも除外・配信停止・契約中なら、そのアドレスには送らない
  const blockedEmails = new Set<string>();
  const all = new Set<string>();
  for (const r of rows ?? []) {
    const email = String(r.email ?? "").trim().toLowerCase();
    if (!email) continue;
    all.add(email);
    if (r.excluded || r.sent_at || (r.matched_store_id && blockedStores.has(r.matched_store_id as string))) blockedEmails.add(email);
  }
  return Array.from(all).filter((e) => !blockedEmails.has(e)).sort();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendSalesEmail(formData: FormData) {
  const subject = String(formData.get("subject") ?? "").trim().replace(/^[*＊\s]*件名[*＊\s]*[:：][*＊\s]*/, "").trim();
  const body = String(formData.get("body") ?? "").trim().replace(/^[*＊\s]*本文[*＊\s]*[:：][*＊\s]*/, "").trim();
  if (!subject || !body) throw new Error("件名と本文を入力してください。");
  // 特定電子メール法: 送信者名・住所・配信停止の方法が本文にあることを確かめる
  if (!body.includes("配信停止") || !body.includes("株式会社Give Rise")) {
    throw new Error("本文に送信者名(株式会社Give Rise)と配信停止の案内を入れてください。");
  }

  const supabase = await createClient();
  const recipients = await getSalesRecipients();
  if (recipients.length === 0) throw new Error("送信先がありません(全て送信済み・除外済みです)。");

  const svc = createServiceRoleClient();
  const sent: string[] = [];
  const failed: { to: string; error: string }[] = [];
  for (const to of recipients) {
    const r = await sendBulkEmail({ recipients: [to], subject, text: body });
    if (r.sent.length) {
      sent.push(to);
      // 二重送信を防ぐため、送れたアドレスはすぐ送信済みにする
      await svc.from("sales_contact_import").update({ sent_at: new Date().toISOString() }).eq("email", to);
    } else failed.push(...r.failed);
    await sleep(600); // Resendの送信上限(1秒あたり)に当たらないように
  }

  await logAdminAction(supabase, "store_bulk_email_sent", "store_contract", undefined, {
    subject,
    kind: "sales",
    sentCount: sent.length,
    failedCount: failed.length,
    failed,
    toEmail: true,
    storeEmailRecipients: sent,
    body: body.slice(0, 2000),
  });

  const jar = await cookies();
  jar.set("bulk_email_result", JSON.stringify({ sentCount: sent.length, failedCount: failed.length, failed, toEmail: true }), {
    httpOnly: true, maxAge: 60, path: "/admin/stores/bulk-email",
  });
  revalidatePath("/admin/stores/bulk-email");
  redirect("/admin/stores/bulk-email");
}

/** 「配信停止」の返信があったアドレスを止める(同じアドレスの店舗すべて) */
export async function optOutSalesEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error("メールアドレスを入力してください。");
  const supabase = await createClient();
  const svc = createServiceRoleClient();
  const { data: rows } = await svc.from("sales_contact_import").select("matched_store_id").eq("email", email);
  const ids = (rows ?? []).map((r) => r.matched_store_id as string | null).filter((v): v is string => !!v);
  await svc.from("sales_contact_import").update({ excluded: true, excluded_reason: "配信停止の連絡あり" }).eq("email", email);
  if (ids.length) await svc.from("stores").update({ sales_email_opt_out: true }).in("id", ids);
  await logAdminAction(supabase, "sales_email_opt_out", "store", undefined, { email, storeIds: ids, rows: (rows ?? []).length });
  revalidatePath("/admin/stores/bulk-email");
  redirect("/admin/stores/bulk-email");
}
