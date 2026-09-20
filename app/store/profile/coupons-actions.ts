"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  if (!title) {
    throw new Error("クーポンのタイトルを入力してください。");
  }

  const { error } = await supabase.from("coupons").insert({
    store_id: storeId,
    title,
    discount: discount || null,
    description: description || null,
    code: code || null,
    valid_until: validUntil || null,
    usage_limit: usageLimit,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
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
}
