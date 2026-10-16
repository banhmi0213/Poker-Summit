"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";

const failTo = (message: string): never => redirect(`/admin/reports?status=all&error=${encodeURIComponent(message)}`);
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function setReportStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, `report_${status}`, "report", id);
  revalidatePath("/admin/reports");
}

export async function deleteReport(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("reports").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "report_delete", "report", id);
  revalidatePath("/admin/reports");
}

/** 運営メモ(何を確認したか・どう対応したか)を保存 */
export async function saveReportMemo(id: string, formData: FormData) {
  const supabase = await createClient();
  const memo = String(formData.get("memo") ?? "").trim().slice(0, 2000) || null;
  const { error } = await supabase.from("reports").update({ admin_memo: memo }).eq("id", id);
  if (error) failTo(`メモを保存できませんでした：${error.message}`);
  await logAdminAction(supabase, "report_memo", "report", id);
  revalidatePath("/admin/reports");
}

/**
 * 通報された対象をその場で非表示/表示に戻す(掲示板の投稿・返信、求人)。
 * 非表示にしたら通報は「確認中」に進める(対応済みにするかは運営が判断)。
 */
export async function moderateReportTarget(id: string, mode: "hide" | "show") {
  const supabase = await createClient();
  const { data: report, error: readError } = await supabase.from("reports").select("target_type, target_id, status").eq("id", id).maybeSingle();
  if (readError || !report) failTo("通報が見つかりません。");
  const table =
    report!.target_type === "post" ? "board_posts" : report!.target_type === "reply" ? "board_replies" : report!.target_type === "job" ? "jobs" : null;
  if (!table) failTo("この種類の通報は、この画面から非表示にできません。");
  const value =
    report!.target_type === "job" ? (mode === "hide" ? "closed" : "open") : mode === "hide" ? "hidden" : "visible";
  const { error } = await supabase.from(table!).update({ status: value }).eq("id", report!.target_id);
  if (error) failTo(`変更できませんでした：${error.message}`);
  if (mode === "hide" && report!.status === "open") {
    await supabase.from("reports").update({ status: "investigating" }).eq("id", id);
  }
  await logAdminAction(supabase, `report_target_${mode}`, report!.target_type, report!.target_id, { report_id: id });
  revalidatePath("/admin/reports");
  revalidatePath("/board");
  revalidatePath("/jobs");
}
