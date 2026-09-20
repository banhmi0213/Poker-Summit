"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deleteOwnAccount() {
  const supabase = await createClient();

  const { error } = await supabase.rpc("member_delete_self");

  if (error) {
    redirect(`/account/delete?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/?withdrawn=1");
}
