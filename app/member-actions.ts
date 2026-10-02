"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/mypage");
  }

  const { data: suspended } = await supabase.rpc("is_suspended");
  if (suspended) {
    redirect("/account/suspended");
  }

  return { supabase, user };
}

export async function toggleFavoriteStore(storeId: string, path: string) {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("favorite_stores")
    .select("store_id")
    .eq("user_id", user.id)
    .eq("store_id", storeId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("favorite_stores")
      .delete()
      .eq("user_id", user.id)
      .eq("store_id", storeId);
  } else {
    await supabase
      .from("favorite_stores")
      .insert({ user_id: user.id, store_id: storeId });
  }

  revalidatePath(path);
}

export async function toggleFavoriteJob(jobId: string, path: string) {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("favorite_jobs")
    .select("job_id")
    .eq("user_id", user.id)
    .eq("job_id", jobId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("favorite_jobs")
      .delete()
      .eq("user_id", user.id)
      .eq("job_id", jobId);
  } else {
    await supabase.from("favorite_jobs").insert({ user_id: user.id, job_id: jobId });
  }

  revalidatePath(path);
}

// 以前はボタン一発で即「応募済み」になる仕様だったが、「応募押したらすぐに
// 応募済みになるから応募フォームを作成設置」との指摘を受け、お名前・電話
// 番号・メッセージを入力してから送信する応募フォーム経由に変更
// (2026/10)。求人詳細ページ(/jobs/[id])の応募フォームから呼ばれる。
export async function submitJobApplication(formData: FormData) {
  const { supabase, user } = await requireUser();

  const jobId = String(formData.get("jobId") ?? "");
  const path = String(formData.get("path") ?? "/jobs");
  const name = String(formData.get("name") ?? "").trim();
  const tel = String(formData.get("tel") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!jobId) {
    redirect(path + "?applyError=" + encodeURIComponent("求人情報が正しくありません。"));
  }
  if (!name) {
    redirect(path + "?applyError=" + encodeURIComponent("お名前を入力してください。") + "#apply");
  }

  const { error } = await supabase.from("job_applications").insert({
    user_id: user.id,
    job_id: jobId,
    name,
    tel: tel || null,
    message: message || null,
  });

  if (error && !error.message.includes("duplicate")) {
    redirect(path + "?applyError=" + encodeURIComponent(error.message) + "#apply");
  }

  revalidatePath(path);
  redirect(path + "?applyDone=1");
}

export async function joinEvent(eventId: string, path: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("event_participants")
    .insert({ user_id: user.id, event_id: eventId });

  if (error && !error.message.includes("duplicate")) {
    throw new Error(error.message);
  }

  revalidatePath(path);
}

export async function leaveEvent(eventId: string, path: string) {
  const { supabase, user } = await requireUser();

  await supabase
    .from("event_participants")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", eventId);

  revalidatePath(path);
}

export async function useCoupon(couponId: string, path: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("use_coupon", { p_coupon_id: couponId });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(path);
}
