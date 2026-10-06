"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pushLineMessage } from "@/lib/line";
import { sendJobApplicationNotificationEmail } from "@/lib/email";

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
  revalidatePath("/");
  revalidatePath("/stores");
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
// その後、枠の上に年齢・性別・ディーラー経験のチップ選択を追加し、枠の中にも
// 住所・面接希望日・志望動機を追加(2026/10)。message列は「メッセージ(PR)」
// 用途に変更したため、志望動機は motivation 列として別に保存する。
export async function submitJobApplication(formData: FormData) {
  const { supabase, user } = await requireUser();

  const jobId = String(formData.get("jobId") ?? "");
  const path = String(formData.get("path") ?? "/jobs");
  const name = String(formData.get("name") ?? "").trim();
  const tel = String(formData.get("tel") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const ageRaw = String(formData.get("age") ?? "").trim();
  const age = ageRaw ? Number(ageRaw) : null;
  const gender = String(formData.get("gender") ?? "").trim();
  const dealerExperience = String(formData.get("dealerExperience") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const interviewDate = String(formData.get("interviewDate") ?? "").trim();
  const motivation = String(formData.get("motivation") ?? "").trim();

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
    email: email || null,
    message: message || null,
    age: age && !Number.isNaN(age) ? age : null,
    gender: gender || null,
    dealer_experience: dealerExperience || null,
    address: address || null,
    interview_date: interviewDate || null,
    motivation: motivation || null,
  });

  if (error && !error.message.includes("duplicate")) {
    redirect(path + "?applyError=" + encodeURIComponent(error.message) + "#apply");
  }

  // 新規応募(重複エラーではない=初回の応募)の場合のみ、店舗オーナーへ
  // LINEとメールで通知する(2026/10、「応募がきたら店舗オーナーにLINEと
  // メールで連絡が飛ぶようにして」との指示を受けて追加)。
  // 宛先は get_job_notification_target() RPC(security definer)経由で
  // 取得する — ここで使っている supabase クライアントは応募者自身の
  // セッションで、store_contracts へのSELECT権限を持たない(管理者/
  // 店舗オーナーのみ。RLS参照)ため。
  // 通知はベストエフォート: LINE未連携・メール未設定・送信失敗のいずれ
  // でも応募受付自体は止めない(pushLineMessage()・
  // sendJobApplicationNotificationEmail()と同じ方針)。
  if (!error) {
    try {
      const { data: target } = await supabase
        .rpc("get_job_notification_target", { p_job_id: jobId })
        .maybeSingle();

      if (target) {
        if (target.line_user_id) {
          await pushLineMessage(
            target.line_user_id,
            `【Poker Summit】求人「${target.job_title}」に応募がありました。\n応募者: ${name}\n店舗管理画面の「求人管理」からご確認ください。`
          );
        }
        if (target.contact_email) {
          await sendJobApplicationNotificationEmail({
            to: target.contact_email,
            storeName: target.store_name,
            jobTitle: target.job_title,
            applicantName: name,
          });
        }
      }
    } catch {
      // ベストエフォート: 通知失敗で応募受付自体は止めない
    }
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
