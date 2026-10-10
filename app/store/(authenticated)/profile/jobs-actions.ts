"use server";

import { revalidatePath } from "next/cache";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { uploadBannerImage, removeBannerImage } from "@/lib/store-banner-upload";
import { getStorePlan, jobLimitOf } from "@/lib/plan-entitlements";

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

// 求人の新規掲載だけ、契約プランの求人数の上限をサーバー側でも先に確認する
// ライト・スタンダードは求人掲載アドオン1件、プレミアムは無制限。画像アップロード前に弾くためのもので、最終的な上限は
// DBトリガー(db/plan_tiers.sql の jobs_enforce_plan_limit)が強制する。
// 既存求人の編集・削除・募集終了はオーナー確認のみ。
async function getOwnedStoreIdForCreate(storeId: string) {
  const supabase = await getOwnedStoreId(storeId);

  const limit = jobLimitOf(await getStorePlan(supabase, storeId));
  if (limit === 0) {
    throw new Error("求人掲載1件（月額8,800円）のアドオン、またはプレミアムプランでご利用いただけます。");
  }
  if (limit !== null) {
    const { count } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "open");
    if ((count ?? 0) >= limit) {
      throw new Error(`現在のプランで同時に募集できる求人は${limit}件までです。ほかの求人を募集終了にするか、プランの変更をご検討ください。`);
    }
  }

  return supabase;
}

export async function createJob(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const supabase = await getOwnedStoreIdForCreate(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const jobType = String(formData.get("jobType") ?? "").trim();
  const salary = String(formData.get("salary") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const bannerFile = formData.get("bannerImage");

  if (!title) {
    throw new Error("求人タイトルを入力してください。");
  }

  let bannerImageUrl: string | null = null;
  let bannerStoragePath: string | null = null;
  if (bannerFile instanceof File && bannerFile.size > 0) {
    const uploaded = await uploadBannerImage(supabase, storeId, "jobs", bannerFile);
    bannerImageUrl = uploaded.url;
    bannerStoragePath = uploaded.path;
  }

  const { error } = await supabase.from("jobs").insert({
    store_id: storeId,
    title,
    job_type: jobType || null,
    salary: salary || null,
    description: description || null,
    banner_image_url: bannerImageUrl,
    banner_storage_path: bannerStoragePath,
  });

  if (error) {
    if (bannerStoragePath) {
      await removeBannerImage(supabase, bannerStoragePath);
    }
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
  revalidatePath("/store/profile/jobs");
  revalidatePath("/jobs", "layout");
  revalidatePath("/");
  revalidatePath(`/stores/${storeId}`);
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
  revalidatePath("/store/profile/jobs");
  revalidatePath("/jobs", "layout");
  revalidatePath("/");
  revalidatePath(`/stores/${storeId}`);
}

export async function updateJob(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const supabase = await getOwnedStoreId(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const jobType = String(formData.get("jobType") ?? "").trim();
  const salary = String(formData.get("salary") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const bannerFile = formData.get("bannerImage");
  const removeBanner = formData.get("removeBanner") === "on";

  if (!title) {
    throw new Error("求人タイトルを入力してください。");
  }

  const { data: current } = await supabase
    .from("jobs")
    .select("banner_storage_path")
    .eq("id", jobId)
    .eq("store_id", storeId)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    title,
    job_type: jobType || null,
    salary: salary || null,
    description: description || null,
  };

  let oldPathToRemove: string | null = null;

  if (bannerFile instanceof File && bannerFile.size > 0) {
    const uploaded = await uploadBannerImage(supabase, storeId, "jobs", bannerFile);
    updates.banner_image_url = uploaded.url;
    updates.banner_storage_path = uploaded.path;
    oldPathToRemove = current?.banner_storage_path ?? null;
  } else if (removeBanner) {
    updates.banner_image_url = null;
    updates.banner_storage_path = null;
    oldPathToRemove = current?.banner_storage_path ?? null;
  }

  const { error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", jobId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  if (oldPathToRemove) {
    await removeBannerImage(supabase, oldPathToRemove);
  }

  revalidatePath("/store/profile");
  revalidatePath("/store/profile/jobs");
  revalidatePath("/jobs", "layout");
  revalidatePath("/");
  revalidatePath(`/stores/${storeId}`);
}

export async function deleteJob(jobId: string, storeId: string) {
  const supabase = await getOwnedStoreId(storeId);

  const { data: current } = await supabase
    .from("jobs")
    .select("banner_storage_path")
    .eq("id", jobId)
    .eq("store_id", storeId)
    .maybeSingle();

  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  if (current?.banner_storage_path) {
    await removeBannerImage(supabase, current.banner_storage_path);
  }

  revalidatePath("/store/profile");
  revalidatePath("/store/profile/jobs");
  revalidatePath("/jobs", "layout");
  revalidatePath("/");
  revalidatePath(`/stores/${storeId}`);
}
