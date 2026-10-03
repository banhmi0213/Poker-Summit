"use server";

import { revalidatePath } from "next/cache";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { uploadBannerImage, removeBannerImage } from "@/lib/store-banner-upload";
import { storeHasJobsAddon } from "@/lib/store-addons";

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

// 求人の新規掲載だけ、求人掲載アドオンの契約有無をサーバー側でも弾く
// (2026/10、「店舗管理画面でも求人は見えるようにして求人だそうとしたら契約の
// アナウンスを出して」との指示を受けて変更。以前はgetOwnedStoreId自体がアドオン
// 判定も行っていたため、既存求人の編集・削除・募集終了/再開まで一緒にブロック
// されてしまっていた。既存求人の管理はオーナー確認のみとし、新規作成時のみ
// このチェックを通す)。
async function getOwnedStoreIdForCreate(storeId: string) {
  const supabase = await getOwnedStoreId(storeId);

  const hasAddon = await storeHasJobsAddon(supabase, storeId);
  if (!hasAddon) {
    throw new Error(
      "求人機能は「求人掲載」アドオンのご契約が必要です。運営にお問い合わせください。"
    );
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
  revalidatePath(`/stores/${storeId}`);
}
