"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { addMonths, jstDateToIso, todayJst } from "@/lib/bank-transfer";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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

  const optInt = (key: string) => {
    if (!formData.has(key)) return undefined;
    const raw = String(formData.get(key) ?? "").trim();
    if (raw === "") return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const majorAreaFee = optInt("majorAreaFee");
  const capacity = optInt("capacity");
  const { error } = await supabase
    .from("addons")
    .update({
      name,
      monthly_fee: monthlyFee,
      description: description || null,
      sort_order: sortOrder,
      ...(majorAreaFee !== undefined ? { major_area_fee: majorAreaFee } : {}),
      ...(capacity !== undefined ? { capacity } : {}),
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
  // 無料期間(知り合いの店など、月額プランを◯か月無料にする。2026/10/20)
  const trialMonths = Math.max(0, Math.min(3, parseInt(String(formData.get("trialMonths") ?? "0"), 10) || 0));

  if (!storeId) {
    throw new Error("店舗を選択してください。");
  }
  if (formData.get("kycConfirmed") !== "on") {
    throw new Error("事業者の確認（本人確認・反社会的勢力のチェック）を済ませてから登録してください。");
  }
  const kycNote = String(formData.get("kycNote") ?? "").trim().slice(0, 1000) || null;
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
      ...(trialMonths > 0
        ? (() => {
            const endIso = jstDateToIso(addMonths(todayJst(), trialMonths));
            return { trial_ends_at: endIso, current_period_end: endIso, billing_method: "card", billing_cycle_months: 1 };
          })()
        : {}),
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
  await logAdminAction(supabase, "contract_create", "store_contract", contract.id, { storeId, planId, trialMonths, kycConfirmed: true, kycNote });

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

async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインしてください。");
  const { data: adminRow } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) throw new Error("運営権限がありません。");
  return user;
}

// 解約(2026/10/18): すぐには止めず、契約期間の終わり(満期)で終了して店舗ページを削除する(lib/contract-cancel.ts)
export async function scheduleContractCancelAction(contractId: string) {
  const user = await requireAdminUser();
  const { scheduleContractCancel } = await import("@/lib/contract-cancel");
  let message = "";
  let failed = false;
  try {
    message = await scheduleContractCancel(contractId, user.id);
  } catch (e) {
    failed = true;
    message = e instanceof Error ? e.message : String(e);
  }
  revalidatePath(CONTRACTS_PATH);
  revalidatePath(`${CONTRACTS_PATH}/${contractId}`);
  redirect(`${CONTRACTS_PATH}/${contractId}?${failed ? "error" : "ok"}=${encodeURIComponent(message)}`);
}

export async function undoContractCancelAction(contractId: string) {
  const user = await requireAdminUser();
  const { undoContractCancel } = await import("@/lib/contract-cancel");
  let message = "";
  let failed = false;
  try {
    message = await undoContractCancel(contractId, user.id);
  } catch (e) {
    failed = true;
    message = e instanceof Error ? e.message : String(e);
  }
  revalidatePath(CONTRACTS_PATH);
  revalidatePath(`${CONTRACTS_PATH}/${contractId}`);
  redirect(`${CONTRACTS_PATH}/${contractId}?${failed ? "error" : "ok"}=${encodeURIComponent(message)}`);
}

// 手動での決済結果記録(運営が手作業で記録する場合の運用手段)。
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

// --- プラン・アドオン変更(店舗オーナー発、/store/profile/plan から) -----
// 2026/10以前は運営がここで承認して初めてstore_contractsに反映される
// 「申請キュー」だったが、店舗オーナー自身のカード決済による即時反映
// (lib/contracts-billing.ts)に置き換えたため、運営の承認アクションは
// 廃止した。plan_change_requests / addon_change_requestsは今は店舗が
// 行った変更の監査ログ・予約状態の記録として、/admin/contracts の一覧
// ページから閲覧専用で参照する(店舗が何を変更し、決済が完了したかを
// 運営が把握できるように、との指示)。


// --- 無料期間(2026/10/20) ----------------------------------------------------
// 無料期間の終わりに、運営が続けるかどうかを決める。
//  振込で続ける … 支払い方法を振込にする。毎朝の自動処理が次の期間の請求書を発行して送る。
//  終了する     … 契約を終わらせる(店舗ページは無料掲載としてそのまま残す。ログインも残す)。
// カードで続ける場合は、店舗が「プラン・お支払い」でカードを登録すれば自動で決済して続く。

export async function continueTrialByBankTransfer(contractId: string) {
  const supabase = await createClient();
  const { data: c } = await supabase.from("store_contracts").select("id, status, trial_ends_at, contact_email").eq("id", contractId).maybeSingle();
  if (!c || c.status !== "active" || !c.trial_ends_at) throw new Error("無料期間の契約が見つかりません。");
  if (!c.contact_email) throw new Error("請求書の送り先(請求先メールアドレス)を先に入れてください。");
  const { error } = await supabase.from("store_contracts").update({ billing_method: "bank_transfer", updated_at: new Date().toISOString() }).eq("id", contractId);
  if (error) throw new Error(error.message);
  await logAdminAction(supabase, "contract_trial_continue_bank", "store_contract", contractId);
  revalidatePath(`${CONTRACTS_PATH}/${contractId}`);
  redirect(`${CONTRACTS_PATH}/${contractId}?ok=${encodeURIComponent("振込で続けるように切り替えました。毎朝9時の自動処理で次の期間の請求書を発行してメールで送ります。")}`);
}

export async function endTrialContract(contractId: string) {
  const supabase = await createClient();
  const { data: c } = await supabase.from("store_contracts").select("id, status, trial_ends_at, store_id").eq("id", contractId).maybeSingle();
  if (!c || c.status !== "active" || !c.trial_ends_at) throw new Error("無料期間の契約が見つかりません。");
  const nowIso = new Date().toISOString();
  // 契約だけを終える。店舗ページ(無料掲載)とログインはそのまま
  const { error } = await createServiceRoleClient()
    .from("store_contracts")
    .update({ status: "canceled", canceled_at: nowIso, cancel_at_period_end: false, updated_at: nowIso })
    .eq("id", contractId);
  if (error) throw new Error(error.message);
  await logAdminAction(supabase, "contract_trial_ended", "store_contract", contractId, { storeId: c.store_id });
  revalidatePath(CONTRACTS_PATH);
  revalidatePath(`${CONTRACTS_PATH}/${contractId}`);
  redirect(`${CONTRACTS_PATH}/${contractId}?ok=${encodeURIComponent("無料期間で契約を終了しました。店舗ページは無料掲載として残ります。")}`);
}
