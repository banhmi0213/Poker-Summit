"use server";

import { revalidatePath } from "next/cache";
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

export async function createJobByAdmin(formData: FormData) {
  const supabase = await createClient();

  const storeId = String(formData.get("storeId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const jobType = String(formData.get("jobType") ?? "").trim();
  const salary = String(formData.get("salary") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!storeId) {
    throw new Error("店舗を選択してください。");
  }
  if (!title) {
    throw new Error("求人タイトルを入力してください。");
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      store_id: storeId,
      title,
      job_type: jobType || null,
      salary: salary || null,
      description: description || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "job_create", "job", data?.id, { storeId, title });
  revalidatePath("/admin/jobs");
}

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
}
