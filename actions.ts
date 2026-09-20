"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setStoreStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/stores");
  revalidatePath("/");
}
