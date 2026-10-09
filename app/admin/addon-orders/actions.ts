"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const PATH = "/admin/addon-orders";
const STATUSES = ["paid", "in_progress", "completed", "canceled"] as const;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインしてください。");
  const { data } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) throw new Error("運営権限がありません。");
  return user;
}

export async function updateAddonOrderAction(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim().slice(0, 2000);
  if (!id || !(STATUSES as readonly string[]).includes(status)) redirect(`${PATH}?error=${encodeURIComponent("状態を選んでください。")}`);
  const svc = createServiceRoleClient();
  const { data: order } = await svc.from("addon_orders").select("status").eq("id", id).maybeSingle();
  if (!order) redirect(`${PATH}?error=${encodeURIComponent("注文が見つかりません。")}`);
  if (order!.status === "awaiting_payment" && status !== "canceled") {
    redirect(`${PATH}?error=${encodeURIComponent("入金待ちの注文は「入金管理」で入金確認してください。")}`);
  }
  await svc
    .from("addon_orders")
    .update({
      status,
      admin_note: adminNote || null,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  await svc.from("audit_log").insert({
    actor_user_id: user.id,
    actor_email: user.email ?? null,
    action: "addon_order_update",
    target_type: "addon_order",
    target_id: id,
    detail: { status },
  });
  revalidatePath(PATH);
  redirect(`${PATH}?ok=${encodeURIComponent("更新しました。")}`);
}
