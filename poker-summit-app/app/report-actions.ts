"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function submitReport(
  targetType: "post" | "reply" | "store" | "job",
  targetId: string,
  reason: string,
  path: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("reports").insert({
    target_type: targetType,
    target_id: targetId,
    reason,
    reporter_user_id: user?.id ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(path);
}

export async function reportPost(postId: string, path: string) {
  await submitReport("post", postId, "ユーザーからの通報", path);
}

export async function reportReply(replyId: string, path: string) {
  await submitReport("reply", replyId, "ユーザーからの通報", path);
}

export async function reportStore(storeId: string, path: string) {
  await submitReport("store", storeId, "ユーザーからの通報", path);
}

export async function reportJob(jobId: string, path: string) {
  await submitReport("job", jobId, "ユーザーからの通報", path);
}
