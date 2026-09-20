"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function setPostStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("board_posts")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, `board_post_${status}`, "board_post", id);
  revalidatePath("/admin/board");
}

export async function setReplyStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("board_replies")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, `board_reply_${status}`, "board_reply", id);
  revalidatePath("/admin/board");
}
