"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { WITHDRAWAL_REASONS } from "./reasons";

export async function deleteOwnAccount(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("member_delete_self");

  if (error) {
    redirect(`/account/delete?error=${encodeURIComponent(error.message)}`);
  }

  // 退会理由(任意)。誰の退会かは記録しない
  const reason = String(formData.get("reason") ?? "");
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000);
  if ((WITHDRAWAL_REASONS as readonly string[]).includes(reason) || comment) {
    try {
      await createServiceRoleClient()
        .from("withdrawal_reasons")
        .insert({ reason: (WITHDRAWAL_REASONS as readonly string[]).includes(reason) ? reason : null, comment: comment || null });
    } catch {
      // 理由の保存に失敗しても退会は完了している
    }
  }

  await supabase.auth.signOut();
  redirect("/?withdrawn=1");
}
