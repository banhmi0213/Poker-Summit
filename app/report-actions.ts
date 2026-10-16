"use server";

import { revalidatePath } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

const REASON_MAX = 60;
const DETAIL_MAX = 1000;

function readReason(formData?: FormData) {
  const reason = String(formData?.get("reason") ?? "").trim().slice(0, REASON_MAX) || "ユーザーからの通報";
  const detail = String(formData?.get("detail") ?? "").trim().slice(0, DETAIL_MAX) || null;
  return { reason, detail };
}

async function submitReport(
  targetType: "post" | "reply" | "store" | "job",
  targetId: string,
  formData: FormData | undefined,
  path: string
) {
  const { reason, detail } = readReason(formData);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("reports").insert({
    target_type: targetType,
    target_id: targetId,
    reason,
    detail,
    reporter_email: (() => { const e = String(formData?.get("reporterEmail") ?? "").trim(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null; })(),
    reporter_user_id: user?.id ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(path);
}

export async function reportPost(postId: string, path: string, formData?: FormData) {
  await submitReport("post", postId, formData, path);
}

export async function reportReply(replyId: string, path: string, formData?: FormData) {
  await submitReport("reply", replyId, formData, path);
}

export async function reportStore(storeId: string, path: string, formData?: FormData) {
  await submitReport("store", storeId, formData, path);
}

export async function reportJob(jobId: string, path: string, formData?: FormData) {
  await submitReport("job", jobId, formData, path);
}
