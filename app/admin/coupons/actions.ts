"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function setCouponActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").update({ active }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, active ? "coupon_activate" : "coupon_deactivate", "coupon", id);
  revalidatePath("/admin/coupons");
}

export async function deleteCoupon(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "coupon_delete", "coupon", id);
  revalidatePath("/admin/coupons");
}
