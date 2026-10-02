"use server";

import { revalidatePath } from "next/cache";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { uploadBannerImage, removeBannerImage } from "@/lib/store-banner-upload";

async function getOwnedStoreClient(storeId: string) {
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

export async function createCoupon(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const supabase = await getOwnedStoreClient(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const discount = String(formData.get("discount") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const validUntil = String(formData.get("validUntil") ?? "").trim();
  const usageLimitRaw = String(formData.get("usageLimit") ?? "").trim();
  const usageLimit = usageLimitRaw ? parseInt(usageLimitRaw, 10) : null;
  // 特典タイプ(2026/10、「チップと検索欄を実際にクーポンを絞り込める機能に
  // する」との指示でcoupons.offer_typeを新設)。COUPON_OFFER_TYPE_OPTIONS
  // のいずれかか、未設定(空文字→null)。
  const offerType = String(formData.get("offerType") ?? "").trim();
  const bannerFile = formData.get("bannerImage");

  if (!title) {
    throw new Error("クーポンのタイトルを入力してください。");
  }

  let bannerImageUrl: string | null = null;
  let bannerStoragePath: string | null = null;
  if (bannerFile instanceof File && bannerFile.size > 0) {
    const uploaded = await uploadBannerImage(supabase, storeId, "coupons", bannerFile);
    bannerImageUrl = uploaded.url;
    bannerStoragePath = uploaded.path;
  }

  const { error } = await supabase.from("coupons").insert({
    store_id: storeId,
    title,
    discount: discount || null,
    description: description || null,
    code: code || null,
    valid_until: validUntil || null,
    usage_limit: usageLimit,
    offer_type: offerType || null,
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
  revalidatePath("/store/profile/coupons");
  revalidatePath(`/stores/${storeId}`);
}

export async function deactivateCoupon(couponId: string, storeId: string) {
  const supabase = await getOwnedStoreClient(storeId);

  const { error } = await supabase
    .from("coupons")
    .update({ active: false })
    .eq("id", couponId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
  revalidatePath("/store/profile/coupons");
  revalidatePath(`/stores/${storeId}`);
}

export async function updateCoupon(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const couponId = String(formData.get("couponId") ?? "");
  const supabase = await getOwnedStoreClient(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const discount = String(formData.get("discount") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const validUntil = String(formData.get("validUntil") ?? "").trim();
  const usageLimitRaw = String(formData.get("usageLimit") ?? "").trim();
  const usageLimit = usageLimitRaw ? parseInt(usageLimitRaw, 10) : null;
  const offerType = String(formData.get("offerType") ?? "").trim();
  const bannerFile = formData.get("bannerImage");
  const removeBanner = formData.get("removeBanner") === "on";

  if (!title) {
    throw new Error("クーポンのタイトルを入力してください。");
  }

  const { data: current } = await supabase
    .from("coupons")
    .select("banner_storage_path")
    .eq("id", couponId)
    .eq("store_id", storeId)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    title,
    discount: discount || null,
    description: description || null,
    code: code || null,
    valid_until: validUntil || null,
    usage_limit: usageLimit,
    offer_type: offerType || null,
  };

  let oldPathToRemove: string | null = null;

  if (bannerFile instanceof File && bannerFile.size > 0) {
    const uploaded = await uploadBannerImage(supabase, storeId, "coupons", bannerFile);
    updates.banner_image_url = uploaded.url;
    updates.banner_storage_path = uploaded.path;
    oldPathToRemove = current?.banner_storage_path ?? null;
  } else if (removeBanner) {
    updates.banner_image_url = null;
    updates.banner_storage_path = null;
    oldPathToRemove = current?.banner_storage_path ?? null;
  }

  const { error } = await supabase
    .from("coupons")
    .update(updates)
    .eq("id", couponId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  if (oldPathToRemove) {
    await removeBannerImage(supabase, oldPathToRemove);
  }

  revalidatePath("/store/profile");
  revalidatePath("/store/profile/coupons");
  revalidatePath(`/stores/${storeId}`);
}

export async function deleteCoupon(couponId: string, storeId: string) {
  const supabase = await getOwnedStoreClient(storeId);

  const { data: current } = await supabase
    .from("coupons")
    .select("banner_storage_path")
    .eq("id", couponId)
    .eq("store_id", storeId)
    .maybeSingle();

  const { error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", couponId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  if (current?.banner_storage_path) {
    await removeBannerImage(supabase, current.banner_storage_path);
  }

  revalidatePath("/store/profile");
  revalidatePath("/store/profile/coupons");
  revalidatePath(`/stores/${storeId}`);
}
