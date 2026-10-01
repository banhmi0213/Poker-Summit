"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { sendBulkEmail } from "@/lib/email";

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

  if (recipients.length === 0) {
    throw new Error("送信先の店舗メールアドレスが見つかりませんでした。");
  }

  const result = await sendBulkEmail({ recipients, subject, text: body });

  await logAdminAction(supabase, "store_bulk_email_sent", "store_contract", undefined, {
    subject,
    sentCount: result.sent.length,
    failedCount: result.failed.length,
    failed: result.failed,
  });

  const jar = await cookies();
  jar.set(
    "bulk_email_result",
    JSON.stringify({
      sentCount: result.sent.length,
      failedCount: result.failed.length,
      failed: result.failed,
    }),
    { httpOnly: true, maxAge: 60, path: "/admin/stores/bulk-email" }
  );

  revalidatePath("/admin/stores/bulk-email");
  redirect("/admin/stores/bulk-email");
}
