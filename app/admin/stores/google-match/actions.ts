"use server";

import { revalidatePath } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { matchNextStores } from "@/lib/google-match";
import { regeocodeNextStores } from "@/lib/regeocode";
import { fetchNextGoogleHours } from "@/lib/google-hours";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインしてください。");
  const { data } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) throw new Error("運営権限がありません。");
  return user;
}

/** 未確認の店舗を少しずつGoogleと照合する(画面から繰り返し呼ぶ) */
export async function runGoogleMatchBatch() {
  await requireAdmin();
  const out = await matchNextStores(16);
  return {
    processed: out.results.length,
    remaining: out.remaining,
    counts: out.results.reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {}),
  };
}

/** 座標を国土地理院で取り直す(画面から繰り返し呼ぶ) */
export async function runRegeocodeBatch() {
  await requireAdmin();
  return regeocodeNextStores(40);
}

/** 営業時間が空の店舗の営業時間をGoogleから取る(画面から繰り返し呼ぶ。月間上限あり) */
export async function runGoogleHoursBatch() {
  await requireAdmin();
  const r = await fetchNextGoogleHours(30);
  revalidatePath("/admin/stores/google-match");
  return r;
}

/** 確認待ちの店舗への対応: 候補で確定 / 非公開にする / 確認済みにする */
export async function resolveGoogleMatch(formData: FormData) {
  const user = await requireAdmin();
  const storeId = String(formData.get("storeId") ?? "");
  const action = String(formData.get("action") ?? "");
  const placeId = String(formData.get("placeId") ?? "") || null;
  const svc = createServiceRoleClient();

  if (action === "confirm" && placeId) {
    const { error } = await svc
      .from("stores")
      .update({ google_place_id: placeId, google_match_status: "matched" })
      .eq("id", storeId);
    if (error) throw new Error(error.message.includes("duplicate") ? "その場所は別の店舗に結びついています。" : error.message);
  } else if (action === "hide") {
    await svc.from("stores").update({ status: "rejected", google_match_status: "hidden_by_admin" }).eq("id", storeId);
  } else if (action === "keep") {
    await svc.from("stores").update({ google_match_status: "checked_by_admin" }).eq("id", storeId);
  }
  await svc.from("audit_log").insert({
    actor_user_id: user.id,
    actor_email: user.email ?? null,
    action: `google_match_${action}`,
    target_type: "store",
    target_id: storeId,
    detail: { placeId },
  });
  revalidatePath("/admin/stores/google-match");
}

/** 照合をやり直す(結果を消して未確認に戻す) */
export async function resetGoogleMatch(formData: FormData) {
  await requireAdmin();
  const storeId = String(formData.get("storeId") ?? "");
  const svc = createServiceRoleClient();
  await svc
    .from("stores")
    .update({ google_checked_at: null, google_match_status: null, google_match_note: null })
    .eq("id", storeId)
    .is("google_place_id", null);
  revalidatePath("/admin/stores/google-match");
}
