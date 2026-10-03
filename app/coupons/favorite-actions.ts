"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setFavoriteCoupon(couponId: string, saved: boolean) {
  if (!/^[0-9a-f-]{36}$/i.test(couponId)) throw new Error("クーポン情報が正しくありません。");
  const path = `/coupons/${couponId}`;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  const { data: suspended, error: suspensionError } = await supabase.rpc("is_suspended");
  if (suspensionError) throw new Error("会員情報を確認できませんでした。");
  if (suspended) redirect("/account/suspended");
  if (saved) {
    const { error } = await supabase.from("favorite_coupons").insert({ user_id: user.id, coupon_id: couponId });
    if (error && error.code !== "23505") throw new Error("お気に入りを保存できませんでした。");
  } else {
    const { error } = await supabase.from("favorite_coupons").delete().eq("user_id", user.id).eq("coupon_id", couponId);
    if (error) throw new Error("お気に入りを解除できませんでした。");
  }
  revalidatePath(path);
  revalidatePath("/mypage");
}
