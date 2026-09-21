"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function approveApplication(id: string) {
  const supabase = await createClient();

  const { data: application, error: fetchError } = await supabase
    .from("listing_applications")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !application) {
    throw new Error(fetchError?.message ?? "申込が見つかりません。");
  }

  const { data: store, error: insertError } = await supabase
    .from("stores")
    .insert({
      name: application.company_name,
      category: application.category,
      pref: application.pref,
      tel: application.tel,
      status: "pending",
      source_application_id: application.id,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { error: updateError } = await supabase
    .from("listing_applications")
    .update({ status: "approved", store_id: store.id })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await logAdminAction(supabase, "application_approve", "listing_application", id, {
    storeId: store.id,
  });

  revalidatePath("/admin/listing-applications");
  revalidatePath("/admin/stores");
}

export async function rejectApplication(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("listing_applications")
    .update({ status: "rejected" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "application_reject", "listing_application", id);

  revalidatePath("/admin/listing-applications");
}

export async function revertApplication(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("listing_applications")
    .update({ status: "pending" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "application_revert", "listing_application", id);

  revalidatePath("/admin/listing-applications");
}
