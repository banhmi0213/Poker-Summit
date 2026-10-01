"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

const CONTRACTS_PATH = "/admin/contracts";

// --- プラン マスタ -----------------------------------------------------

export async function createPlan(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const monthlyFee = parseInt(String(formData.get("monthlyFee") ?? "0"), 10) || 0;
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0;

  if (!name) {
    throw new Error("プラン名を入力してください。");
  }

  const { data, error } = await supabase
    .from("plans")
    .insert({
      name,
      monthly_fee: monthlyFee,
      description: description || null,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "plan_create", "plan", data.id, { name, monthlyFee });
  revalidatePath(`${CONTRACTS_PATH}/plans`);
}

export async function updatePlan(formData: FormData) {
  const supabase = await createClient();
  const planId = String(formData.get("planId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const monthlyFee = parseInt(String(formData.get("monthlyFee") ?? "0"), 10) || 0;
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0;

  if (!name) {
    throw new Error("プラン名を入力してください。");
  }

  const { error } = await supabase
    .from("plans")
    .update({
      name,
      monthly_fee: monthlyFee,
      description: description || null,
      sort_order: sortOrder,
    })
    .eq("id", planId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "plan_edit", "plan", planId);
  revalidatePath(`${CONTRACTS_PATH}/plans`);
}

export async function togglePlanActive(planId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("plans").update({ active }).eq("id", planId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, active ? "plan_activate" : "plan_deactivate", "plan", planId);
  revalidatePath(`${CONTRACTS_PATH}/plans`);
}

// --- アドオン マスタ -----------------------------------------------------

export async function createAddon(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const monthlyFee = parseInt(String(formData.get("monthlyFee") ?? "0"), 10) || 0;
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0;

  if (!name) {
    throw new Error("アドオン名を入力してください。");
  }

  const { data, error } = await supabase
    .from("addons")
    .insert({
      name,
      monthly_fee: monthlyFee,
      description: description || null,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "addon_create", "addon", data.id, { name, monthlyFee });
  revalidatePath(`${CONTRACTS_PATH}/plans`);
}

export async function updateAddon(formData: FormData) {
  const supabase = await createClient();
  const addonId = String(formData.get("addonId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const monthlyFee = parseInt(String(formData.get("monthlyFee") ?? "0"), 10) || 0;
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0;

  if (!name) {
    throw new Error("アドオン名を入力してください。");
  }

  const { error } = await supabase
    .from("addons")
    .update({
      name,
      monthly_fee: monthlyFee,
      description: description || null,
      sort_order: sortOrder,
    })
    .eq("id", addonId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "addon_edit", "addon", addonId);
  revalidatePath(`${CONTRACTS_PATH}/plans`);
}

export async function toggleAddonActive(addonId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("addons").update({ active }).eq("id", addonId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, active ? "addon_activate" : "addon_deactivate", "addon", addonId);
  revalidatePath(`${CONTRACTS_PATH}/plans`);
}

// --- 契約店舗 -----------------------------------------------------

async function replaceContractAddons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeContractId: string,
  addonIds: string[]
) {
  const { error: deleteError } = await supabase
    .from("store_contract_addons")
    .delete()
    .eq("store_contract_id", storeContractId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (addonIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("store_contract_addons")
    .insert(addonIds.map((addonId) => ({ store_contract_id: storeContractId, addon_id: addonId })));

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function createContract(formData: FormData) {
  const supabase = await createClient();

  const storeId = String(formData.get("storeId") ?? "");
  const planId = String(formData.get("planId") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const contactTel = String(formData.get("contactTel") ?? "").trim();
  const addonIds = formData.getAll("addonIds").map(String).filter(Boolean);

  if (!storeId) {
    throw new Error("店舗を選択してください。");
  }
  if (!planId) {
    throw new Error("プランを選択してください。");
  }

  const { data: contract, error } = await supabase
    .from("store_contracts")
    .insert({
      store_id: storeId,
      plan_id: planId,
      contact_name: contactName || null,
      contact_email: contactEmail || null,
      contact_tel: contactTel || null,
    })
    .select("id")
    .single();

  if (error) {
    // store_id has a unique constraint — a store can only have one contract.
    if (error.code === "23505") {
      throw new Error("この店舗にはすでに契約が登録されています。");
    }
    throw new Error(error.message);
  }

  await replaceContractAddons(supabase, contract.id, addonIds);
  await logAdminAction(supabase, "contract_create", "store_contract", contract.id, { storeId, planId });

  revalidatePath(CONTRACTS_PATH);
  revalidatePath(`${CONTRACTS_PATH}/${contract.id}`);
  redirect(`${CONTRACTS_PATH}/${contract.id}`);
}

export async function updateContract(formData: FormData) {
  const supabase = await createClient();

  const contractId = String(formData.get("contractId") ?? "");
  const planId = String(formData.get("planId") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const contactTel = String(formData.get("contactTel") ?? "").trim();
  const addonIds = formData.getAll("addonIds").map(String).filter(Boolean);

  if (!planId) {
    throw new Error("プランを選択してください。");
  }

  const { error } = await supabase
    .from("store_contracts")
    .update({
      plan_id: planId,
      contact_name: contactName || null,
      contact_email: contactEmail || null,
      contact_tel: contactTel || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId);

  if (error) {
    throw new Error(error.message);
  }

  await replaceContractAddons(supabase, contractId, addonIds);
  await logAdminAction(supabase, "contract_edit", "store_contract", contractId);

  revalidatePath(CONTRACTS_PATH);
  revalidatePath(`${CONTRACTS_PATH}/${contractId}`);
}

export async function setContractStatus(contractId: string, status: "active" | "canceled") {
  const supabase = await createClient();

  const { error } = await supabase
    .from("store_contracts")
    .update({
      status,
      canceled_at: status === "canceled" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId);

  if (error) {
    throw new Error(error.message);
  }

  if (status === "canceled") {
    await supabase.from("billing_events").insert({
      store_contract_id: contractId,
      event_type: "canceled",
      source: "manual",
    });
  }

  await logAdminAction(supabase, status === "canceled" ? "contract_cancel" : "contract_reactivate", "store_contract", contractId);

  revalidatePath(CONTRACTS_PATH);
  revalidatePath(`${CONTRACTS_PATH}/${contractId}`);
}

// 手動での決済結果記録。fincode Webhook連携が入るまでの運用手段であり、
// 連携後もWebhookが失敗した際の手動フォロー用として残す想定。
export async function recordManualBillingEvent(formData: FormData) {
  const supabase = await createClient();

  const contractId = String(formData.get("contractId") ?? "");
  const eventType = String(formData.get("eventType") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = amountRaw ? parseInt(amountRaw, 10) : null;
  const note = String(formData.get("note") ?? "").trim();

  if (eventType !== "success" && eventType !== "failed") {
    throw new Error("決済結果を選択してください。");
  }

  const occurredAt = new Date().toISOString();

  const { error: insertError } = await supabase.from("billing_events").insert({
    store_contract_id: contractId,
    event_type: eventType,
    amount,
    occurred_at: occurredAt,
    source: "manual",
    note: note || null,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { error: updateError } = await supabase
    .from("store_contracts")
    .update({ last_billing_status: eventType, last_billing_at: occurredAt })
    .eq("id", contractId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await logAdminAction(supabase, `contract_billing_${eventType}`, "store_contract", contractId, { amount, note });

  revalidatePath(CONTRACTS_PATH);
  revalidatePath(`${CONTRACTS_PATH}/${contractId}`);
}

// --- プラン変更申請(店舗オーナー発、/store/profile/plan から) -----------
// 店舗オーナー側はfincode決済を直接叩けないため、申請止まりになって
// いる。ここで承認するとstore_contracts.plan_idを実際に切り替える
// (決済金額自体の変更・請求はfincode側で別途運営が対応する想定で、
// この承認操作はあくまで「契約上のプランを確定させる」ところまで)。
export async function approvePlanChangeRequest(requestId: string) {
  const supabase = await createClient();

  const { data: request, error: fetchError } = await supabase
    .from("plan_change_requests")
    .select("id, store_id, store_contract_id, requested_plan_id, status")
    .eq("id", requestId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (!request) throw new Error("申請が見つかりません。");
  if (request.status !== "pending") throw new Error("この申請はすでに処理済みです。");

  if (!request.store_contract_id) {
    throw new Error(
      "この店舗には契約(store_contracts)がまだ登録されていません。先に契約を登録してください。"
    );
  }

  const { error: updateContractError } = await supabase
    .from("store_contracts")
    .update({ plan_id: request.requested_plan_id, updated_at: new Date().toISOString() })
    .eq("id", request.store_contract_id);
  if (updateContractError) throw new Error(updateContractError.message);

  const { error: updateRequestError } = await supabase
    .from("plan_change_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updateRequestError) throw new Error(updateRequestError.message);

  await logAdminAction(supabase, "plan_change_request_approve", "store_contract", request.store_contract_id, {
    requestId,
    requestedPlanId: request.requested_plan_id,
  });

  revalidatePath(CONTRACTS_PATH);
  revalidatePath(`${CONTRACTS_PATH}/${request.store_contract_id}`);
}

export async function rejectPlanChangeRequest(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!requestId) throw new Error("申請が指定されていません。");

  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_change_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      review_note: note || null,
    })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  await logAdminAction(supabase, "plan_change_request_reject", "plan_change_request", requestId, { note });

  revalidatePath(CONTRACTS_PATH);
}

// --- アドオン変更申請(店舗オーナー発、/store/profile/plan から) -----------
// プラン変更申請と同じ運用。承認するとstore_contract_addonsを申請内容
// (requested_addon_ids、丸ごと置き換え)で確定させる(2026/10新設、
// 「店舗がアドオン申請できるようにせなあかん」との指示)。
export async function approveAddonChangeRequest(requestId: string) {
  const supabase = await createClient();

  const { data: request, error: fetchError } = await supabase
    .from("addon_change_requests")
    .select("id, store_id, store_contract_id, requested_addon_ids, status")
    .eq("id", requestId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (!request) throw new Error("申請が見つかりません。");
  if (request.status !== "pending") throw new Error("この申請はすでに処理済みです。");

  if (!request.store_contract_id) {
    throw new Error(
      "この店舗には契約(store_contracts)がまだ登録されていません。先に契約を登録してください。"
    );
  }

  await replaceContractAddons(supabase, request.store_contract_id, request.requested_addon_ids ?? []);

  const { error: updateRequestError } = await supabase
    .from("addon_change_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updateRequestError) throw new Error(updateRequestError.message);

  await logAdminAction(supabase, "addon_change_request_approve", "store_contract", request.store_contract_id, {
    requestId,
    requestedAddonIds: request.requested_addon_ids,
  });

  revalidatePath(CONTRACTS_PATH);
  revalidatePath(`${CONTRACTS_PATH}/${request.store_contract_id}`);
}

export async function rejectAddonChangeRequest(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!requestId) throw new Error("申請が指定されていません。");

  const supabase = await createClient();
  const { error } = await supabase
    .from("addon_change_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      review_note: note || null,
    })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  await logAdminAction(supabase, "addon_change_request_reject", "addon_change_request", requestId, { note });

  revalidatePath(CONTRACTS_PATH);
}
