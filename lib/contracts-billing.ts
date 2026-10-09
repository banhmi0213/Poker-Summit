import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getDefaultCardId,
  chargeFincodeCardOnce,
  createFincodePlan,
  createFincodeSubscription,
  cancelFincodeSubscription,
} from "@/lib/fincode";
import { recordStoreHistory } from "@/lib/store-update";
import { addonFeeFor } from "@/lib/addons";

// ============================================================================
// プラン・アドオンの「店舗が自分で決済して即時反映」機能(2026/10新設)。
//
// 方針(ユーザー指示、2026/10):
// - 金額が上がる変更(プラン変更・アドオン追加)は、日割りなしで満額を
//   即時決済し、その場で機能解放する。決済した日を起点に「翌月同日まで」
//   が新しい1ヶ月(current_period_end)になる。
// - 金額が下がる変更(プラン変更・アドオン解除)は、即座には何もしない。
//   今の契約期間(current_period_end)が終わるタイミングで、新しい金額を
//   改めて決済してから切り替える(apply-scheduled-contract-changesの
//   cronジョブが担当)。
//
// 設計: 1契約(store_contracts)につきfincodeサブスクリプションは常に1本
// (プラン料金+アクティブなアドオン料金の合計額)。金額が変わるたびに、
// 古いサブスクを解約し、その金額専用のfincodeプラン(都度作成、使い回し
// しない — 変更頻度が低い想定の小規模運用なので単純さを優先)を作って
// 新しいサブスクに差し替える。
// ============================================================================

type Supa = ReturnType<typeof createServiceRoleClient>;

async function loadContract(supabase: Supa, storeContractId: string) {
  const { data, error } = await supabase
    .from("store_contracts")
    .select(
      "id, store_id, plan_id, fincode_customer_id, fincode_subscription_id, pending_plan_id, pending_plan_effective_at"
    )
    .eq("id", storeContractId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "契約が見つかりません。");
  return data;
}

function addOneMonthIso(from: Date = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

// プラン名・アドオン名から、都度作成するfincodeプランの表示名を作る。
function buildPlanLabel(planName: string, addonNames: string[]): string {
  return addonNames.length > 0 ? `${planName}+${addonNames.join("+")}` : planName;
}

// プラン・アドオンの「現在の確定状態」を、満額決済のうえ即座に適用する。
// 呼び出し元: 金額が上がる即時反映リクエスト、および期間終了時に保留中の
// 変更を確定させるcronジョブの両方から使う共通処理。
export async function applyContractBillingChange(params: {
  storeContractId: string;
  newPlanId: string;
  newAddonIds: string[];
  // true: このプラン(ダウングレード等)の保留をこの呼び出しで解消する。
  // false: アドオンだけの変更など、プラン側の保留は手を付けず、期間だけ
  //        新しいcurrent_period_endへずらす(保留中の適用日を先送りする)。
  resolvesPendingPlan: boolean;
}): Promise<{ chargedAmount: number; newPeriodEnd: string }> {
  const supabase = createServiceRoleClient();
  const contract = await loadContract(supabase, params.storeContractId);

  if (!contract.fincode_customer_id) {
    throw new Error("この契約にはカード情報が登録されていません。運営にお問い合わせください。");
  }

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, name, monthly_fee")
    .eq("id", params.newPlanId)
    .single();
  if (planError || !plan) throw new Error("プランが見つかりません。");

  // カードで払う月額アドオンだけがこの決済・サブスクの対象(振込で払うアドオンは別の請求書)。
  // 地域PICKUPは店舗の都道府県で料金が変わる(lib/addons.ts addonFeeFor)。
  const { data: storeRow } = await supabase.from("stores").select("pref").eq("id", contract.store_id).maybeSingle();
  const pref = (storeRow?.pref as string | null) ?? null;
  const { data: addonRows, error: addonsError } = params.newAddonIds.length
    ? await supabase
        .from("addons")
        .select("id, name, monthly_fee, major_area_fee, major_area_prefs, billing_type")
        .in("id", params.newAddonIds)
    : { data: [] as any[], error: null };
  if (addonsError) throw new Error(addonsError.message);
  const addons = ((addonRows ?? []) as any[])
    .filter((a) => a.billing_type !== "one_time")
    .map((a) => ({ ...a, fee: addonFeeFor(a, pref) as number }));

  const addonFeeTotal = addons.reduce((sum, a) => sum + (a.fee ?? 0), 0);
  const total = (plan.monthly_fee ?? 0) + addonFeeTotal;

  const cardId = await getDefaultCardId(contract.fincode_customer_id).catch(() => null);
  if (!cardId) {
    throw new Error("カード情報が確認できませんでした。カードの再登録が必要な可能性があります。");
  }

  // 同一契約が何度も課金されうるので、注文IDは毎回ユニークにする
  // (申込み時のorderIdは1回限りの決済なので固定IDでよかったが、こちらは
  // 使い回せない)。
  // fincodeのオーダーIDは30文字まで。以前は契約IDだけで30文字を使い切って時刻部分が
  // 切り捨てられ、同じ契約の2回目以降の決済が「オーダーIDはすでに登録されています」
  // (EC001025014)で失敗していた。契約IDの先頭+時刻+乱数で毎回ユニークにする。
  const orderId = (
    "c" +
    contract.id.replace(/-/g, "").slice(0, 12) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  ).slice(0, 30);

  const charge = await chargeFincodeCardOnce({
    orderId,
    customerId: contract.fincode_customer_id,
    cardId,
    amount: total,
  });

  if (charge.status !== "CAPTURED") {
    await supabase.from("billing_events").insert({
      store_contract_id: contract.id,
      event_type: "failed",
      amount: total,
      source: "contract_change",
      note: `決済失敗: status=${charge.status} error_code=${charge.error_code ?? "-"}`,
    });
    await supabase
      .from("store_contracts")
      .update({ last_billing_status: "failed", last_billing_at: new Date().toISOString() })
      .eq("id", contract.id);
    throw new Error("決済が完了しませんでした。カード情報をご確認ください。");
  }

  // 決済成功後はお金を実際に取れている状態。以降の処理(新サブスク作成等)が
  // 失敗しても「失敗扱いで終わり」にはできない — 例外を投げず、できる
  // ところまでは反映してbilling_eventsに記録を残す。
  const fincodePlan = await createFincodePlan({
    name: buildPlanLabel(plan.name, addons.map((a) => a.name)),
    monthlyFee: total,
  });
  const subscription = await createFincodeSubscription({
    customerId: contract.fincode_customer_id,
    cardId,
    fincodePlanId: fincodePlan.id,
  });

  if (contract.fincode_subscription_id) {
    await cancelFincodeSubscription(contract.fincode_subscription_id).catch(() => {
      // 既に無効化済み等は無視してよい(ベストエフォート)。
    });
  }

  const nowIso = new Date().toISOString();
  const newPeriodEnd = addOneMonthIso();

  const contractUpdate: Record<string, unknown> = {
    plan_id: params.newPlanId,
    fincode_subscription_id: subscription.id,
    current_period_end: newPeriodEnd,
    last_billing_status: "success",
    last_billing_at: nowIso,
    updated_at: nowIso,
  };

  if (params.resolvesPendingPlan) {
    contractUpdate.pending_plan_id = null;
    contractUpdate.pending_plan_effective_at = null;
  } else if (contract.pending_plan_id) {
    // プラン以外(アドオン)の変更で課金サイクルが今リセットされたので、
    // まだ適用していないプランのダウングレード予約があれば、新しい
    // current_period_endに合わせて適用日を先送りする。
    contractUpdate.pending_plan_effective_at = newPeriodEnd;
  }

  const { error: updateError } = await supabase
    .from("store_contracts")
    .update(contractUpdate)
    .eq("id", contract.id);
  if (updateError) throw new Error(updateError.message);

  // store_contract_addons を新しい構成に丸ごと置き換える(保留中の解除
  // 予約もここで全部クリアされる=新しい期間がまっさらにスタートする)。
  // 既にある行は残し(PICK UP表示が一瞬外れないように)、外れたものだけ消して、増えたものを足す。
  const { data: existingRows } = await supabase
    .from("store_contract_addons")
    .select("id, addon_id")
    .eq("store_contract_id", contract.id)
    .eq("billing_method", "card")
    .is("fincode_subscription_id", null);
  const keepIds = new Set(addons.map((a) => a.id as string));
  const existingIds = new Set(((existingRows ?? []) as any[]).map((r) => r.addon_id as string));
  const removeRowIds = ((existingRows ?? []) as any[]).filter((r) => !keepIds.has(r.addon_id)).map((r) => r.id);
  if (removeRowIds.length) await supabase.from("store_contract_addons").delete().in("id", removeRowIds);
  await supabase
    .from("store_contract_addons")
    .update({ pending_removed_at: null })
    .eq("store_contract_id", contract.id)
    .eq("billing_method", "card")
    .is("fincode_subscription_id", null);
  for (const a of addons) {
    if (existingIds.has(a.id)) {
      await supabase.from("store_contract_addons").update({ fee: a.fee }).eq("store_contract_id", contract.id).eq("addon_id", a.id);
      continue;
    }
    const { error: insertError } = await supabase
      .from("store_contract_addons")
      .insert({ store_contract_id: contract.id, addon_id: a.id, fee: a.fee, billing_method: "card" });
    if (insertError) throw new Error(insertError.message);
  }

  await supabase.from("billing_events").insert({
    store_contract_id: contract.id,
    event_type: "success",
    amount: total,
    source: "contract_change",
    note: `プラン・アドオン変更の即時決済(${plan.name}${
      addons.length ? " + " + addons.map((a) => a.name).join("、") : ""
    })`,
  });

  await recordStoreHistory(supabase, {
    storeId: contract.store_id,
    actorType: "web",
    actorLabel: "web:self-serve-billing",
    field: "contract_plan_addons_changed",
    oldValue: null,
    newValue: { planId: params.newPlanId, addonIds: params.newAddonIds, chargedAmount: total },
  });

  return { chargedAmount: total, newPeriodEnd };
}

// 金額が下がるプラン変更: 今すぐには切り替えず、現在の契約期間が終わる
// タイミングで適用されるよう予約するだけ(課金なし)。
export async function schedulePlanDowngrade(params: {
  storeContractId: string;
  newPlanId: string;
}): Promise<{ effectiveAt: string }> {
  const supabase = createServiceRoleClient();
  const { data: contract, error } = await supabase
    .from("store_contracts")
    .select("id, current_period_end")
    .eq("id", params.storeContractId)
    .single();
  if (error || !contract) throw new Error(error?.message ?? "契約が見つかりません。");

  // current_period_endが無い(極めて古い契約等)場合は、次回のcron実行で
  // 即適用される形にフォールバックする。
  const effectiveAt = contract.current_period_end ?? new Date().toISOString();

  const { error: updateError } = await supabase
    .from("store_contracts")
    .update({ pending_plan_id: params.newPlanId, pending_plan_effective_at: effectiveAt })
    .eq("id", params.storeContractId);
  if (updateError) throw new Error(updateError.message);

  return { effectiveAt };
}

export async function cancelScheduledPlanChange(storeContractId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("store_contracts")
    .update({ pending_plan_id: null, pending_plan_effective_at: null })
    .eq("id", storeContractId);
  if (error) throw new Error(error.message);
}

// 金額が下がるアドオン変更(解除): 今すぐには外さず、現在の契約期間が
// 終わるタイミングで外れるよう予約するだけ(課金なし)。
export async function scheduleAddonRemovals(params: {
  storeContractId: string;
  addonIdsToRemove: string[];
}): Promise<{ effectiveAt: string }> {
  const supabase = createServiceRoleClient();
  const { data: contract, error } = await supabase
    .from("store_contracts")
    .select("id, current_period_end")
    .eq("id", params.storeContractId)
    .single();
  if (error || !contract) throw new Error(error?.message ?? "契約が見つかりません。");

  const effectiveAt = contract.current_period_end ?? new Date().toISOString();

  if (params.addonIdsToRemove.length > 0) {
    const { error: updateError } = await supabase
      .from("store_contract_addons")
      .update({ pending_removed_at: effectiveAt })
      .eq("store_contract_id", params.storeContractId)
      .in("addon_id", params.addonIdsToRemove);
    if (updateError) throw new Error(updateError.message);
  }

  return { effectiveAt };
}

export async function cancelScheduledAddonRemovals(storeContractId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("store_contract_addons")
    .update({ pending_removed_at: null })
    .eq("store_contract_id", storeContractId)
    .not("pending_removed_at", "is", null);
  if (error) throw new Error(error.message);
}
