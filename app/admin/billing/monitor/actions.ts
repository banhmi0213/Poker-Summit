"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveAndResume, provisionPaidApplication } from "@/lib/payment-resume";

const PATH = "/admin/billing/monitor";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインしてください。");
  const { data: adminRow } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) throw new Error("運営権限がありません。");
  return user;
}

function back(kind: "ok" | "error", message: string): never {
  redirect(`${PATH}?${kind}=${encodeURIComponent(message)}`);
}

/** 結果不明の決済をKOMOJUで確かめて、続きの処理を行う(新たに決済はしない) */
export async function resolveAttemptAction(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get("attemptId") ?? "");
  let message = "";
  let failed = false;
  try {
    message = await resolveAndResume(id, user.id);
    await createServiceRoleClient().from("audit_log").insert({ actor_user_id: user.id, actor_email: user.email ?? null, action: "payment_attempt_resolved", target_type: "payment_attempt", target_id: id, detail: { message } });
  } catch (e) {
    failed = true;
    message = e instanceof Error ? e.message : String(e);
  }
  revalidatePath(PATH);
  back(failed ? "error" : "ok", message);
}

/** 決済済みで店舗の発行が止まっている新規申込みの店舗を発行する */
export async function provisionApplicationAction(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get("applicationId") ?? "");
  let message = "";
  let failed = false;
  try {
    message = await provisionPaidApplication(id, null);
    await createServiceRoleClient().from("audit_log").insert({ actor_user_id: user.id, actor_email: user.email ?? null, action: "paid_application_provisioned_manual", target_type: "listing_application", target_id: id, detail: {} });
  } catch (e) {
    failed = true;
    message = e instanceof Error ? e.message : String(e);
  }
  revalidatePath(PATH);
  back(failed ? "error" : "ok", message);
}
