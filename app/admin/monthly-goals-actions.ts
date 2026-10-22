"use server";
// 今月の目標を保存する(2026/10/22)
import { redirect } from "next/navigation";
import { revalidatePath } from "@/lib/revalidate";
import { reportAccess } from "./dealer-chat-reports/access";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAdminAction } from "@/lib/audit";

export async function saveMonthlyGoals(form: FormData) {
  const db = await reportAccess();
  const num = (k: string) => Math.max(0, Math.min(100000000, Math.floor(Number(form.get(k)) || 0)));
  const goals = { pv: num("pv"), uu: num("uu"), members: num("members"), dealers: num("dealers"), paid_stores: num("paid_stores") };
  const { error } = await createServiceRoleClient().from("site_settings").update({ monthly_goals: goals }).eq("id", true);
  if (error) throw new Error("目標を保存できませんでした: " + error.message);
  await logAdminAction(db, "monthly_goals_updated", "site_settings", undefined, goals);
  revalidatePath("/admin");
  redirect("/admin");
}
