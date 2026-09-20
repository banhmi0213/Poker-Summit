"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function addNgWord(formData: FormData) {
  const supabase = await createClient();
  const word = String(formData.get("word") ?? "").trim();

  if (!word) {
    throw new Error("NGワードを入力してください。");
  }

  const { error } = await supabase.from("ng_words").insert({ word });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "ng_word_add", "ng_word", undefined, { word });

  revalidatePath("/admin/ng-words");
}

export async function deleteNgWord(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("ng_words").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "ng_word_delete", "ng_word", id);

  revalidatePath("/admin/ng-words");
}
