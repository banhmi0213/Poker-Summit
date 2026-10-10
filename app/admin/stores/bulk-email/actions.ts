"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  const recipients = await getActiveStoreRecipients(supabase);

  const lineScope = String(formData.get("lineScope") ?? "none"); // none / contracted / all
  if (recipients.length === 0 && lineScope === "none") {
    throw new Error("送信先の店舗メールアドレスが見つかりませんでした。");
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

  await logAdminAction(supabase, "store_bulk_email_sent", "store_contract", undefined, {
    subject,
    sentCount: result.sent.length,
    failedCount: result.failed.length,
    failed: result.failed,
    lineScope,
    lineSent,
  });

  const jar = await cookies();
  jar.set(
    "bulk_email_result",
    JSON.stringify({
      sentCount: result.sent.length,
      failedCount: result.failed.length,
      failed: result.failed,
      lineSent,
    }),
    { httpOnly: true, maxAge: 60, path: "/admin/stores/bulk-email" }
  );

  revalidatePath("/admin/stores/bulk-email");
  redirect("/admin/stores/bulk-email");
}
