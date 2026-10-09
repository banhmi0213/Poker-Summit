// アドオンの購入(2026/10)。カードはその場で決済、銀行振込は請求書を発行して入金確認で有効化。
//  月額(カード): 契約のカード決済・サブスクにまとめる(lib/contracts-billing.ts applyContractBillingChange)
//  月額(振込): アドオンごとに1か月分の請求書。入金確認で有効化し、期間終了の7日前に次の請求書(cron)
//  都度: スポット求人1件掲載は追加掲載枠を付与。制作系は運営が対応(総合管理「アドオン注文」)
// 書き込みは service-role。呼び出し元で店舗オーナー/運営の確認を済ませること。

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { addonFeeFor, type AddonRow, ADDON_COLUMNS } from "@/lib/addons";
import {
  addDays,
  addMonths,
  getBillingSettings,
  isoToJstDate,
  jstDateToIso,
  sendInvoice,
  todayJst,
  type InvoiceRow,
} from "@/lib/bank-transfer";

export type AddonOrderRow = {
  id: string;
  store_id: string;
  store_contract_id: string | null;
  addon_id: string | null;
  addon_code: string | null;
  addon_name: string;
  billing_type: "monthly" | "one_time";
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: "card" | "bank_transfer";
  status: "awaiting_payment" | "paid" | "in_progress" | "completed" | "canceled";
  invoice_id: string | null;
  note: string | null;
  admin_note: string | null;
  created_at: string;
  paid_at: string | null;
  completed_at: string | null;
};

const taxOf = (total: number) => Math.floor((total * 10) / 110);

export async function loadAddon(addonId: string): Promise<AddonRow | null> {
  const svc = createServiceRoleClient();
  const { data } = await svc.from("addons").select(ADDON_COLUMNS).eq("id", addonId).maybeSingle();
  return (data as AddonRow | null) ?? null;
}

/** 振込のアドオン請求書(1件)。月額は1か月分、都度は数量分。 */
export async function createAddonInvoice(params: {
  storeId: string;
  storeContractId: string | null;
  billToName: string;
  billToContact: string | null;
  billToEmail: string;
  addonName: string;
  unitPrice: number;
  quantity: number;
  monthly: boolean;
  periodStart?: string | null; // 月額の更新分: 'YYYY-MM-DD'
  addonOrderId?: string | null;
  storeContractAddonId?: string | null;
}): Promise<InvoiceRow> {
  const svc = createServiceRoleClient();
  const settings = await getBillingSettings(svc);
  const total = params.unitPrice * params.quantity;
  const periodStart = params.periodStart ?? null;
  const periodEnd = periodStart ? addDays(addMonths(periodStart, 1), -1) : null;
  const sub = params.monthly
    ? periodStart
      ? `対象期間：${periodStart.replace(/-/g, "/")}〜${periodEnd!.replace(/-/g, "/")}（1か月）`
      : "対象期間：ご入金確認日から1か月（以降は毎月ご請求）"
    : null;
  const { data, error } = await svc
    .from("invoices")
    .insert({
      kind: "addon",
      store_contract_id: params.storeContractId,
      store_id: params.storeId,
      bill_to_name: params.billToName,
      bill_to_contact: params.billToContact,
      bill_to_email: params.billToEmail,
      plan_id: null,
      plan_name: params.addonName,
      monthly_fee: params.unitPrice,
      months: 1,
      discount_label: null,
      discount_amount: 0,
      total_amount: total,
      tax_amount: taxOf(total),
      period_start: periodStart,
      period_end: periodEnd,
      due_date: addDays(todayJst(), settings.dueDays),
      items: [
        {
          label: `Poker Summit アドオン　${params.addonName}`,
          sub,
          quantity: params.monthly ? "1か月" : String(params.quantity),
          unit_price: params.unitPrice,
          amount: total,
        },
      ],
      addon_order_id: params.addonOrderId ?? null,
      store_contract_addon_id: params.storeContractAddonId ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "請求書を作成できませんでした。");
  try {
    await sendInvoice(data as InvoiceRow, settings, periodStart ? "renewal" : "renewal");
  } catch (e) {
    await svc.from("audit_log").insert({
      actor_user_id: null,
      actor_email: null,
      action: "invoice_email_failed",
      target_type: "invoice",
      target_id: (data as InvoiceRow).id,
      detail: { error: e instanceof Error ? e.message : String(e) },
    });
  }
  return data as InvoiceRow;
}

/** お支払いが済んだ注文の効果を反映する(カード決済直後・振込の入金確認の両方から)。 */
export async function fulfillPaidAddonOrder(orderId: string) {
  const svc = createServiceRoleClient();
  const { data: order } = await svc.from("addon_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("注文が見つかりません。");
  const o = order as AddonOrderRow;
  const nowIso = new Date().toISOString();

  if (o.billing_type === "monthly") {
    // 振込で払う月額アドオンを有効化(1か月)
    if (!o.store_contract_id || !o.addon_id) throw new Error("契約またはアドオンが見つかりません。");
    const periodEndIso = jstDateToIso(addMonths(todayJst(), 1));
    const { data: existing } = await svc
      .from("store_contract_addons")
      .select("id")
      .eq("store_contract_id", o.store_contract_id)
      .eq("addon_id", o.addon_id)
      .maybeSingle();
    if (existing) {
      await svc
        .from("store_contract_addons")
        .update({ current_period_end: periodEndIso, pending_removed_at: null, billing_method: "bank_transfer", fee: o.unit_price })
        .eq("id", existing.id);
    } else {
      const { error } = await svc.from("store_contract_addons").insert({
        store_contract_id: o.store_contract_id,
        addon_id: o.addon_id,
        fee: o.unit_price,
        billing_method: "bank_transfer",
        current_period_end: periodEndIso,
      });
      if (error) throw new Error(error.message);
    }
    await svc.from("addon_orders").update({ status: "completed", paid_at: o.paid_at ?? nowIso, completed_at: nowIso }).eq("id", o.id);
    return;
  }

  if (o.addon_code === "spot_job_credit") {
    const { data: credit } = await svc.from("store_spot_credits").select("balance").eq("store_id", o.store_id).maybeSingle();
    if (credit) {
      await svc
        .from("store_spot_credits")
        .update({ balance: (credit.balance ?? 0) + o.quantity, updated_at: nowIso })
        .eq("store_id", o.store_id);
    } else {
      await svc.from("store_spot_credits").insert({ store_id: o.store_id, balance: o.quantity });
    }
    await svc.from("addon_orders").update({ status: "completed", paid_at: o.paid_at ?? nowIso, completed_at: nowIso }).eq("id", o.id);
    return;
  }

  // 制作・設定が必要なもの(記事・動画・撮影)は運営の対応待ちにする
  await svc.from("addon_orders").update({ status: "paid", paid_at: o.paid_at ?? nowIso }).eq("id", o.id);
  try {
    const { sendAddonOrderAdminEmail } = await import("@/lib/email");
    const { data: store } = await svc.from("stores").select("name").eq("id", o.store_id).maybeSingle();
    await sendAddonOrderAdminEmail({
      storeName: store?.name ?? "店舗",
      addonName: o.addon_name,
      quantity: o.quantity,
      total: o.total_amount,
      paymentMethod: o.payment_method,
      note: o.note,
    });
  } catch {
    // 通知はベストエフォート
  }
}

/** 振込の請求書(kind='addon')の入金を確認したとき(lib/bank-transfer.ts confirmInvoicePayment から)。 */
export async function confirmAddonInvoice(inv: InvoiceRow & { addon_order_id?: string | null; store_contract_addon_id?: string | null }) {
  const svc = createServiceRoleClient();
  if (inv.addon_order_id) {
    await svc.from("addon_orders").update({ paid_at: new Date().toISOString() }).eq("id", inv.addon_order_id);
    await fulfillPaidAddonOrder(inv.addon_order_id);
    return;
  }
  if (inv.store_contract_addon_id) {
    // 月額アドオンの更新分: 期間を1か月延ばす
    const { data: row } = await svc
      .from("store_contract_addons")
      .select("id, current_period_end")
      .eq("id", inv.store_contract_addon_id)
      .maybeSingle();
    const start = inv.period_start ?? (row?.current_period_end ? isoToJstDate(row.current_period_end) : todayJst());
    const nextIso = jstDateToIso(addMonths(start, 1));
    if (row) {
      await svc.from("store_contract_addons").update({ current_period_end: nextIso }).eq("id", row.id);
    }
  }
}

/** 店舗のアドオン購入(店舗管理画面から)。戻り値は画面に出すメッセージ。 */
export async function purchaseAddon(params: {
  storeId: string;
  addonId: string;
  quantity: number;
  paymentMethod: "card" | "bank_transfer";
  note: string | null;
}): Promise<string> {
  const svc = createServiceRoleClient();
  const addon = await loadAddon(params.addonId);
  if (!addon || !addon.active || !addon.code) throw new Error("このアドオンは現在お申し込みいただけません。");

  const [{ data: contract }, { data: store }, settings] = await Promise.all([
    svc
      .from("store_contracts")
      .select("id, status, plan_id, billing_method, fincode_customer_id, contact_name, contact_email, store_contract_addons(id, addon_id, billing_method)")
      .eq("store_id", params.storeId)
      .maybeSingle(),
    svc.from("stores").select("id, name, pref").eq("id", params.storeId).maybeSingle(),
    getBillingSettings(svc),
  ]);
  if (!contract || contract.status !== "active") throw new Error("有効な契約がありません。運営にお問い合わせください。");
  if (!store) throw new Error("店舗が見つかりません。");

  const method = params.paymentMethod;
  if (method === "card") {
    if (!settings.cardPaymentEnabled) throw new Error("現在クレジットカードでのお支払いは受け付けておりません。銀行振込をお選びください。");
    if (!contract.fincode_customer_id) throw new Error("カードが登録されていないため、銀行振込をお選びください。");
  }
  if (!contract.contact_email && method === "bank_transfer") {
    throw new Error("契約の連絡先メールアドレスが未登録のため請求書を送れません。運営にお問い合わせください。");
  }

  const unitPrice = addonFeeFor(addon, store.pref);
  const quantity = addon.billing_type === "monthly" ? 1 : Math.max(1, Math.min(addon.code === "spot_job_credit" ? 50 : 5, Math.floor(params.quantity || 1)));
  const total = unitPrice * quantity;
  const current = ((contract.store_contract_addons ?? []) as { id: string; addon_id: string; billing_method: string }[]);

  if (addon.billing_type === "monthly") {
    if (current.some((r) => r.addon_id === addon.id)) throw new Error(`「${addon.name}」はすでにご契約中です。`);
    // 枠の確認(最終的な判定はDBトリガー)
    const { addonSlotsLeft } = await import("@/lib/addons");
    const left = await addonSlotsLeft(svc, addon, store.pref ?? null, params.storeId);
    if (left !== null && left <= 0) {
      throw new Error(
        addon.capacity_scope === "pref"
          ? `${store.pref ?? "この地域"}の「${addon.name}」は満枠（${addon.capacity}店舗）です。空きが出るまでお待ちください。`
          : `「${addon.name}」は満枠（全国${addon.capacity}店舗）です。空きが出るまでお待ちください。`
      );
    }
    const { data: pending } = await svc
      .from("addon_orders")
      .select("id")
      .eq("store_id", params.storeId)
      .eq("addon_id", addon.id)
      .eq("status", "awaiting_payment")
      .limit(1);
    if (pending?.length) throw new Error(`「${addon.name}」は入金待ちのお申し込みがあります。請求書のお振り込みをお願いします。`);
  }

  // カード: 月額はプラン+カード払いの月額アドオンの合計で即時決済し、サブスクを差し替える(既存の方式)
  if (method === "card" && addon.billing_type === "monthly") {
    const { applyContractBillingChange } = await import("@/lib/contracts-billing");
    const cardAddonIds = current.filter((r) => (r.billing_method ?? "card") === "card").map((r) => r.addon_id);
    const result = await applyContractBillingChange({
      storeContractId: contract.id,
      newPlanId: contract.plan_id,
      newAddonIds: [...cardAddonIds, addon.id],
      resolvesPendingPlan: false,
    });
    await svc.from("addon_orders").insert({
      store_id: params.storeId,
      store_contract_id: contract.id,
      addon_id: addon.id,
      addon_code: addon.code,
      addon_name: addon.name,
      billing_type: "monthly",
      quantity: 1,
      unit_price: unitPrice,
      total_amount: result.chargedAmount,
      payment_method: "card",
      status: addon.needs_fulfillment ? "paid" : "completed",
      note: params.note,
      paid_at: new Date().toISOString(),
      completed_at: addon.needs_fulfillment ? null : new Date().toISOString(),
    });
    if (addon.needs_fulfillment) await notifyAdmin(store.name, addon.name, 1, unitPrice, "card", params.note);
    return `「${addon.name}」を追加しました（プランと合わせて${result.chargedAmount.toLocaleString("ja-JP")}円を決済し、契約期間を今日から1か月に更新しました）。`;
  }

  // 注文を作る
  const { data: order, error: orderError } = await svc
    .from("addon_orders")
    .insert({
      store_id: params.storeId,
      store_contract_id: contract.id,
      addon_id: addon.id,
      addon_code: addon.code,
      addon_name: addon.name,
      billing_type: addon.billing_type,
      quantity,
      unit_price: unitPrice,
      total_amount: total,
      payment_method: method,
      status: "awaiting_payment",
      note: params.note,
    })
    .select("*")
    .single();
  if (orderError || !order) throw new Error(orderError?.message ?? "お申し込みを作成できませんでした。");

  if (method === "bank_transfer") {
    const invoice = await createAddonInvoice({
      storeId: params.storeId,
      storeContractId: contract.id,
      billToName: store.name,
      billToContact: contract.contact_name,
      billToEmail: contract.contact_email!,
      addonName: addon.name,
      unitPrice,
      quantity,
      monthly: addon.billing_type === "monthly",
      addonOrderId: order.id,
    });
    await svc.from("addon_orders").update({ invoice_id: invoice.id }).eq("id", order.id);
    return `「${addon.name}」の請求書（${total.toLocaleString("ja-JP")}円）をメールでお送りしました。ご入金の確認後に${
      addon.billing_type === "monthly" ? "有効になります" : addon.code === "spot_job_credit" ? "掲載枠が追加されます" : "運営からご連絡します"
    }。`;
  }

  // カード・都度払い
  const { getDefaultCardId, chargeFincodeCardOnce } = await import("@/lib/fincode");
  const cardId = await getDefaultCardId(contract.fincode_customer_id!).catch(() => null);
  if (!cardId) {
    await svc.from("addon_orders").update({ status: "canceled", admin_note: "カード情報を確認できず決済できませんでした" }).eq("id", order.id);
    throw new Error("カード情報が確認できませんでした。銀行振込をお選びいただくか、運営にお問い合わせください。");
  }
  const orderId = ("a" + order.id.replace(/-/g, "").slice(0, 12) + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)).slice(0, 30);
  const charge = await chargeFincodeCardOnce({ orderId, customerId: contract.fincode_customer_id!, cardId, amount: total }).catch(
    (e: unknown) => ({ status: "ERROR", error_code: e instanceof Error ? e.message : String(e) }) as any
  );
  if (charge.status !== "CAPTURED") {
    await svc
      .from("addon_orders")
      .update({ status: "canceled", fincode_order_id: orderId, admin_note: `カード決済失敗: ${charge.status} ${charge.error_code ?? ""}` })
      .eq("id", order.id);
    throw new Error("カード決済が完了しませんでした。カード情報をご確認いただくか、銀行振込をお選びください。");
  }
  await svc.from("addon_orders").update({ fincode_order_id: orderId, paid_at: new Date().toISOString() }).eq("id", order.id);
  await svc.from("billing_events").insert({
    store_contract_id: contract.id,
    event_type: "success",
    amount: total,
    source: "contract_change",
    note: `アドオン購入(${addon.name} ×${quantity})`,
  });
  await fulfillPaidAddonOrder(order.id);
  return addon.code === "spot_job_credit"
    ? `スポット求人の掲載枠を${quantity}件追加しました（${total.toLocaleString("ja-JP")}円を決済しました）。`
    : `「${addon.name}」をお申し込みいただきました（${total.toLocaleString("ja-JP")}円を決済しました）。運営から日程などのご連絡をいたします。`;
}

async function notifyAdmin(storeName: string, addonName: string, quantity: number, total: number, paymentMethod: string, note: string | null) {
  try {
    const { sendAddonOrderAdminEmail } = await import("@/lib/email");
    await sendAddonOrderAdminEmail({ storeName, addonName, quantity, total, paymentMethod, note });
  } catch {
    // ベストエフォート
  }
}

/** 月額アドオンの解約(期間の終わりで外す)。 */
export async function cancelMonthlyAddon(params: { storeId: string; storeContractAddonId: string }): Promise<string> {
  const svc = createServiceRoleClient();
  const { data: row } = await svc
    .from("store_contract_addons")
    .select("id, addon_id, billing_method, current_period_end, store_contracts!inner(store_id, current_period_end), addons(name)")
    .eq("id", params.storeContractAddonId)
    .maybeSingle();
  const c = (Array.isArray((row as any)?.store_contracts) ? (row as any).store_contracts[0] : (row as any)?.store_contracts) as
    | { store_id: string; current_period_end: string | null }
    | undefined;
  if (!row || c?.store_id !== params.storeId) throw new Error("アドオンが見つかりません。");
  const name = ((Array.isArray((row as any).addons) ? (row as any).addons[0] : (row as any).addons) as { name?: string } | null)?.name ?? "アドオン";
  const effectiveAt =
    row.billing_method === "bank_transfer" ? row.current_period_end ?? new Date().toISOString() : c.current_period_end ?? new Date().toISOString();
  await svc.from("store_contract_addons").update({ pending_removed_at: effectiveAt }).eq("id", row.id);
  // 振込の更新請求がまだ未入金なら取り消す
  await svc
    .from("invoices")
    .update({ status: "canceled" })
    .eq("store_contract_addon_id", row.id)
    .eq("status", "unpaid");
  const d = new Date(Date.parse(effectiveAt) + 9 * 3600 * 1000);
  return `「${name}」の解約を受け付けました。${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日まではご利用いただけます。`;
}
