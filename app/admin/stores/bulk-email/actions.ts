"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { sendBulkEmail } from "@/lib/email";
import { pushLineMessage } from "@/lib/line";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// 契約ステータスが active の店舗の連絡先メールアドレス(store_contracts.
// contact_email、listing_applications.emailから提供時に引き継がれたもの)を
// 重複なく集める。stores テーブル自体にはメール列がないため、必ず
// store_contracts 経由で取得する(lib/store-provision.ts参照)。
async function getActiveStoreRecipients(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("store_contracts")
    .select("contact_email")
    .eq("status", "active")
    .not("contact_email", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((c) => c.contact_email?.trim())
        .filter((email): email is string => !!email)
    )
  );
}

export async function sendBulkEmailToStores(formData: FormData) {
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!subject || !body) {
    throw new Error("件名と本文を入力してください。");
  }

  const supabase = await createClient();
  // 送り先: 店舗へのメール(+店舗管理画面の受信箱) / LINE / サイトのお知らせ(2026/10/20 サイトを追加)
  const toEmail = formData.get("toEmail") === "on";
  const toSite = formData.get("toSite") === "on";
  // 会員へのメール(大事なお知らせのときだけ使う。2026/10/20)
  const toMembers = formData.get("toMembers") === "on";
  const recipients = toEmail ? await getActiveStoreRecipients(supabase) : [];

  const lineScope = String(formData.get("lineScope") ?? "none"); // none / contracted / all
  if (!toEmail && !toSite && !toMembers && lineScope === "none") {
    throw new Error("送り先(メール・LINE・サイト)を1つ以上選んでください。");
  }
  if (toEmail && recipients.length === 0 && lineScope === "none" && !toSite && !toMembers) {
    throw new Error("送信先の店舗メールアドレスが見つかりませんでした。");
  }

  // サイトのお知らせ(公開サイトの /news に全国・全員向けで出す)
  let siteNotice = false;
  if (toSite) {
    const { data: auth } = await supabase.auth.getUser();
    const { error: siteError } = await supabase.from("site_notices").insert({ title: subject, body, created_by: auth.user?.id ?? null });
    if (siteError) throw new Error(`サイトのお知らせを保存できませんでした: ${siteError.message}`);
    siteNotice = true;
    revalidatePath("/news");
  }

  let memberResult = { sent: [] as string[], failed: [] as { to: string; error: string }[] };
  if (toMembers) {
    const svc = createServiceRoleClient();
    const { data: rows, error: rpcError } = await svc.rpc("member_notice_recipients");
    if (rpcError) throw new Error(`会員の宛先を取得できませんでした: ${rpcError.message}`);
    const memberEmails = Array.from(new Set(((rows ?? []) as Array<{ email: string }>).map((r) => r.email).filter(Boolean)));
    const memberText = `${body}\n\n――――――――――\nPoker Summit運営事務局\nhttps://pokersummit.jp/news\n※このメールは、Poker Summitに会員登録いただいた方へ大切なお知らせとしてお送りしています。`;
    if (memberEmails.length) memberResult = await sendBulkEmail({ recipients: memberEmails, subject: `【Poker Summit】${subject}`, text: memberText });
  }

  const result = recipients.length
    ? await sendBulkEmail({ recipients, subject, text: body })
    : { sent: [] as string[], failed: [] as { to: string; error: string }[] };

  // LINE連携済みの店舗にはLINEでも送る(サイトからのお知らせ)
  let lineSent = 0;
  if (lineScope === "contracted" || lineScope === "all") {
    const svc = createServiceRoleClient();
    let storeQuery = svc.from("stores").select("id, line_user_id").not("line_user_id", "is", null);
    if (lineScope === "contracted") {
      const { data: active } = await svc.from("store_contracts").select("store_id").eq("status", "active");
      const ids = (active ?? []).map((c) => c.store_id as string);
      storeQuery = storeQuery.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    } else {
      storeQuery = storeQuery.in("status", ["approved", "listed", "payment_suspended"]);
    }
    const { data: lineStores } = await storeQuery;
    const userIds = Array.from(new Set((lineStores ?? []).map((s) => s.line_user_id as string).filter(Boolean)));
    const text = `【Poker Summit からのお知らせ】\n${subject}\n\n${body}`.slice(0, 4900);
    for (const userId of userIds) {
      await pushLineMessage(userId, text);
      lineSent++;
    }
  }

  // 店舗管理画面の「運営からのお知らせ」にも残す(契約中の全店舗。メールが届かなくても画面で読める、2026/10)
  let inboxCount = 0;
  if (toEmail) {
    const svc = createServiceRoleClient();
    const { data: activeContracts } = await svc.from("store_contracts").select("store_id").eq("status", "active");
    const storeIds = Array.from(new Set((activeContracts ?? []).map((c) => c.store_id as string).filter(Boolean)));
    if (storeIds.length) {
      const { error: inboxError } = await svc
        .from("store_messages")
        .insert(storeIds.map((store_id) => ({ store_id, title: subject, body })));
      if (!inboxError) inboxCount = storeIds.length;
    }
  }

  await logAdminAction(supabase, "store_bulk_email_sent", "store_contract", undefined, {
    subject,
    sentCount: result.sent.length,
    failedCount: result.failed.length,
    failed: result.failed,
    lineScope,
    lineSent,
    inboxCount,
    toEmail,
    siteNotice,
    toMembers,
    memberSent: memberResult.sent.length,
    memberFailed: memberResult.failed,
  });

  const jar = await cookies();
  jar.set(
    "bulk_email_result",
    JSON.stringify({
      sentCount: result.sent.length,
      failedCount: result.failed.length,
      failed: result.failed,
      lineSent,
      toEmail,
      siteNotice,
      memberSent: toMembers ? memberResult.sent.length : undefined,
      memberFailedCount: toMembers ? memberResult.failed.length : undefined,
    }),
    { httpOnly: true, maxAge: 60, path: "/admin/stores/bulk-email" }
  );

  revalidatePath("/admin/stores/bulk-email");
  redirect("/admin/stores/bulk-email");
}

/** サイトのお知らせを公開/非公開にする(消さずに隠せるように) */
export async function setSiteNoticePublished(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const published = formData.get("published") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("site_notices").update({ published, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminAction(supabase, published ? "site_notice_published" : "site_notice_unpublished", "site_notice", id);
  revalidatePath("/news");
  revalidatePath("/admin/stores/bulk-email");
  redirect("/admin/stores/bulk-email");
}

/** サイトのお知らせを削除する(2026/10/20。元に戻せない) */
export async function deleteSiteNotice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data: row } = await supabase.from("site_notices").select("title").eq("id", id).maybeSingle();
  const { error } = await supabase.from("site_notices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminAction(supabase, "site_notice_deleted", "site_notice", id, { title: row?.title ?? null });
  revalidatePath("/news");
  revalidatePath("/admin/stores/bulk-email");
  redirect("/admin/stores/bulk-email");
}
