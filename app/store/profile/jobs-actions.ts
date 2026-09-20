"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getOwnedStoreId(storeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!store) {
    throw new Error("この店舗を編集する権限がありません。");
  }

  return supabase;
}

export async function createJob(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const supabase = await getOwnedStoreId(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const jobType = String(formData.get("jobType") ?? "").trim();
  const salary = String(formData.get("salary") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title) {
    throw new Error("求人タイトルを入力してください。");
  }

  const { error } = await supabase.from("jobs").insert({
    store_id: storeId,
    title,
    job_type: jobType || null,
    salary: salary || null,
    description: description || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
}

export async function toggleJobStatus(jobId: string, storeId: string, status: string) {
  const supabase = await getOwnedStoreId(storeId);

  const { error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
}
