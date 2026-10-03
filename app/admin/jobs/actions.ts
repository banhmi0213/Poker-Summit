"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function setJobStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ status }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, `job_status_${status}`, "job", id);
  revalidatePath("/admin/jobs");
}

export async function deleteJob(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "job_delete", "job", id);
  revalidatePath("/admin/jobs");
}

// 以前は admin が任意の店舗を選んで代理で求人を作成する createJobByAdmin が
// ここにあったが、求人掲載アドオン未契約の店舗にも公開求人を作れてしまい、かつ
// 店舗オーナー側からは管理できない不整合があったため撤廃(2026/10、「そもそも
// 代理で出すんもやめよか」との指示)。既存求人の編集・ステータス変更・削除
// (moderation)は引き続きここで提供する。

export async function updateJobByAdmin(formData: FormData) {
  const supabase = await createClient();
  const jobId = String(formData.get("jobId") ?? "");

  const title = String(formData.get("title") ?? "").trim();
  const jobType = String(formData.get("jobType") ?? "").trim();
  const salary = String(formData.get("salary") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title) {
    throw new Error("求人タイトルを入力してください。");
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      title,
      job_type: jobType || null,
      salary: salary || null,
      description: description || null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "job_edit", "job", jobId);
  revalidatePath("/admin/jobs");

  // 独立した編集ページ(/admin/jobs/[id]/edit)から呼ばれるようになったので、
  // 保存後は一覧に戻す(admin/stores の編集ページと同じパターン)。
  redirect("/admin/jobs");
}
