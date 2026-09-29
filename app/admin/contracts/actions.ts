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
