"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 店舗オーナーが自分のプランを直接fincode決済まで変更する仕組みはまだ無い
// ため(store_contractsのINSERT/UPDATEは運営のみ許可)、まずは「このプラン
// に変更したい」という申請をplan_change_requestsに記録し、運営が
// /admin/contractsから内容を確認して確定させる運用にする。
// リッチメニュー(LINE)側と同じ「プラン・アップグレード」導線を、LINEを
// 開いていないPCブラウザからでも使えるようにするための機能(2026/09/30)。
export async function requestPlanChange(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const requestedPlanId = String(formData.get("requestedPlanId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!storeId || !requestedPlanId) {
    throw new Error("店舗またはプランが指定されていません。");
  }

  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("store_contracts")
    .select("id, plan_id")
    .eq("store_id", storeId)
    .maybeSingle();

  // 同じ店舗の「審査待ち」申請が既にあれば、二重申請せず更新するだけに
  // する(オーナーが希望プランを変更して送り直した場合の取り違え防止)。
  const { data: existing } = await supabase
    .from("plan_change_requests")
    .select("id")
    .eq("store_id", storeId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("plan_change_requests")
      .update({
        requested_plan_id: requestedPlanId,
        current_plan_id: contract?.plan_id ?? null,
        store_contract_id: contract?.id ?? null,
        note: note || null,
        requested_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("plan_change_requests").insert({
      store_id: storeId,
      store_contract_id: contract?.id ?? null,
      current_plan_id: contract?.plan_id ?? null,
      requested_plan_id: requestedPlanId,
      note: note || null,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/store/profile");
}

export async function cancelPlanChangeRequest(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_change_requests")
    .delete()
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath("/store/profile");
}
