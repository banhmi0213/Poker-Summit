// アドオンの購入(2026/10)。カードはその場で決済、銀行振込は請求書を発行して入金確認で有効化。
//  月額(カード): 初月分をその場で決済し、2か月目からはアドオンごとのサブスクで毎月課金(プラン料金は取り直さない)
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

export type AddonInvoiceLine = {
  addonName: string;
  unitPrice: number;
  quantity: number;
  monthly: boolean;
};

/** 振込のアドオン請求書。複数のアドオンを1枚にまとめられる。月額は1か月分、都度は数量分。 */
export async function createAddonInvoice(params: {
  storeId: string;
  storeContractId: string | null;
  billToName: string;
  billToContact: string | null;
  billToEmail: string;
  lines: AddonInvoiceLine[];
  periodStart?: string | null; // 月額の更新分: 'YYYY-MM-DD'
  addonOrderId?: string | null;
  storeContractAddonId?: string | null;
}): Promise<InvoiceRow> {
  const svc = createServiceRoleClient();
  const settings = await getBillingSettings(svc);
  if (!params.lines.length) throw new Error("請求する内容がありません。");
  const total = params.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const periodStart = params.periodStart ?? null;
  const periodEnd = periodStart ? addDays(addMonths(periodStart, 1), -1) : null;
  const items = params.lines.map((l) => ({
    label: `Poker Summit アドオン　${l.addonName}`,
    sub: l.monthly
      ? periodStart
        ? `対象期間：${periodStart.replace(/-/g, "/")}〜${periodEnd!.replace(/-/g, "/")}（1か月）`
        : "対象期間：ご入金確認日から1か月（以降は毎月ご請求）"
      : null,
    quantity: l.monthly ? "1か月" : String(l.quantity),
    unit_price: l.unitPrice,
    amount: l.unitPrice * l.quantity,
  }));
  const title =
    params.lines.length === 1 ? params.lines[0].addonName : `${params.lines[0].addonName} ほか${params.lines.length - 1}件`;
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
      plan_name: title,
      monthly_fee: params.lines.length === 1 ? params.lines[0].unitPrice : total,
      months: 1,
      discount_label: null,
      discount_amount: 0,
      total_amount: total,
      tax_amount: taxOf(total),
      period_start: periodStart,
      period_end: periodEnd,
      due_date: addDays(todayJst(), settings.dueDays),
      items,
      addon_order_id: params.addonOrderId ?? null,
      store_contract_addon_id: params.storeContractAddonId ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "請求書を作成できませんでした。");
  try {
    await sendInvoice(data as InvoiceRow, settings, "renewal");
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

/** 振込の請求書(kind=addon)の入金を確認したとき(lib/bank-transfer.ts confirmInvoicePayment から)。 */
export async function confirmAddonInvoice(inv: InvoiceRow & { addon_order_id?: string | null; store_contract_addon_id?: string | null }) {
  const svc = createServiceRoleClient();
  // 申込み分: この請求書に紐づく注文をまとめて有効化
  const { data: orders } = await svc.from("addon_orders").select("id, status").eq("invoice_id", inv.id);
  const orderIds = new Set<string>(
    ((orders ?? []) as { id: string; status: string }[]).filter((o) => o.status === "awaiting_payment").map((o) => o.id)
  );
  if (inv.addon_order_id) orderIds.add(inv.addon_order_id);
  for (const id of orderIds) {
    await svc.from("addon_orders").update({ paid_at: new Date().toISOString() }).eq("id", id);
    await fulfillPaidAddonOrder(id);
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

/**
 * 店舗のアドオン購入(店舗管理画面から、複数まとめて)。戻り値は画面に出すメッセージ。
 *  カード: 月額はプラン+カード払いの月額アドオンの合計で決済し直してサブスクを差し替え(既存の方式)、
 *          都度払いは合計額を1回で決済。
 *  振込:   選んだものを1枚の請求書にまとめ、入金確認で全部有効化。
 */
export async function purchaseAddons(params: {
  storeId: string;
  items: Array<{ addonId: string; quantity: number }>;
  paymentMethod: "card" | "bank_transfer";
  note: string | null;
}): Promise<string> {
  const svc = createServiceRoleClient();
  if (!params.items.length) throw new Error("お申し込みするアドオンを選んでください。");

  const [{ data: contract }, { data: store }, settings, { data: addonRows }] = await Promise.all([
    svc
      .from("store_contracts")
      .select("id, status, plan_id, fincode_customer_id, contact_name, contact_email, store_contract_addons(id, addon_id, billing_method, pending_removed_at)")
      .eq("store_id", params.storeId)
      .maybeSingle(),
    svc.from("stores").select("id, name, pref").eq("id", params.storeId).maybeSingle(),
    getBillingSettings(svc),
    svc.from("addons").select(ADDON_COLUMNS).in("id", params.items.map((i) => i.addonId)),
  ]);
  if (!contract || contract.status !== "active") throw new Error("有効な契約がありません。運営にお問い合わせください。");
  if (!store) throw new Error("店舗が見つかりません。");

  const method = params.paymentMethod;
  if (method === "card") {
    if (!settings.cardPaymentEnabled) throw new Error("現在クレジットカードでのお支払いは受け付けておりません。銀行振込をお選びください。");
    if (!contract.fincode_customer_id) throw new Error("カードが登録されていないため、銀行振込をお選びください。");
  } else if (!contract.contact_email) {
    throw new Error("契約の連絡先メールアドレスが未登録のため請求書を送れません。運営にお問い合わせください。");
  }

  const current = (contract.store_contract_addons ?? []) as {
    id: string;
    addon_id: string;
    billing_method: string;
    pending_removed_at: string | null;
  }[];
  const { addonSlotsLeft } = await import("@/lib/addons");
  const lines: Array<{ addon: AddonRow; quantity: number; unitPrice: number }> = [];
  for (const item of params.items) {
    const addon = ((addonRows ?? []) as AddonRow[]).find((a) => a.id === item.addonId);
    if (!addon || !addon.active || !addon.code) throw new Error("お申し込みいただけないアドオンが含まれています。");
    if (addon.billing_type === "monthly") {
      if (current.some((r) => r.addon_id === addon.id)) throw new Error(`「${addon.name}」はすでにご契約中です。`);
      const left = await addonSlotsLeft(svc, addon, store.pref ?? null, params.storeId);
      if (left !== null && left <= 0) {
        throw new Error(
          addon.capacity_scope === "pref"
            ? `${store.pref ?? "この地域"}の「${addon.name}」は満枠です。空きが出るまでお待ちください。`
            : `「${addon.name}」は満枠です。空きが出るまでお待ちください。`
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
    const quantity =
      addon.billing_type === "monthly"
        ? 1
        : Math.max(1, Math.min(addon.code === "spot_job_credit" ? 50 : 5, Math.floor(item.quantity || 1)));
    lines.push({ addon, quantity, unitPrice: addonFeeFor(addon, store.pref) });
  }

  const insertOrder = async (l: (typeof lines)[number], extra: Record<string, unknown>) => {
    const { data, error } = await svc
      .from("addon_orders")
      .insert({
        store_id: params.storeId,
        store_contract_id: contract.id,
        addon_id: l.addon.id,
        addon_code: l.addon.code,
        addon_name: l.addon.name,
        billing_type: l.addon.billing_type,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        total_amount: l.unitPrice * l.quantity,
        payment_method: method,
        note: params.note,
        ...extra,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "お申し込みを作成できませんでした。");
    return data.id as string;
  };

  // ---- 銀行振込: 1枚の請求書にまとめる ----
  if (method === "bank_transfer") {
    const orderIds: string[] = [];
    for (const l of lines) orderIds.push(await insertOrder(l, { status: "awaiting_payment" }));
    const invoice = await createAddonInvoice({
      storeId: params.storeId,
      storeContractId: contract.id,
      billToName: store.name,
      billToContact: contract.contact_name,
      billToEmail: contract.contact_email!,
      lines: lines.map((l) => ({
        addonName: l.addon.name,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        monthly: l.addon.billing_type === "monthly",
      })),
    });
    await svc.from("addon_orders").update({ invoice_id: invoice.id }).in("id", orderIds);
    return `請求書（${invoice.total_amount.toLocaleString("ja-JP")}円）をメールでお送りしました。ご入金の確認後にご利用いただけます。`;
  }

  // ---- カード: 選んだアドオンの合計だけを1回で決済(プラン料金は含めない) ----
  //  月額アドオンは初月分をここで決済し、2か月目からは cron(apply-scheduled-contract-changes)が
  //  アドオンごとの契約期間(current_period_end)の終わりに同じカードへ決済する。
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const orderIds: string[] = [];
  for (const l of lines) orderIds.push(await insertOrder(l, { status: "awaiting_payment" }));
  const { chargeSavedCard, newOrderId } = await import("@/lib/komoju");
  const fincodeOrderId = newOrderId("a", orderIds[0]);
  const charge = await chargeSavedCard({
    orderId: fincodeOrderId,
    customerId: contract.fincode_customer_id!,
    amount: total,
    metadata: { store_contract_id: contract.id },
  });
  if (charge.status !== "CAPTURED") {
    await svc
      .from("addon_orders")
      .update({ status: "canceled", fincode_order_id: fincodeOrderId, admin_note: `カード決済失敗: ${charge.status} ${charge.error_code ?? ""}` })
      .in("id", orderIds);
    throw new Error("カード決済が完了しませんでした。カード情報をご確認いただくか、銀行振込をお選びください。");
  }
  const nowIso = new Date().toISOString();
  await svc.from("addon_orders").update({ fincode_order_id: fincodeOrderId, paid_at: nowIso }).in("id", orderIds);
  await svc.from("billing_events").insert({
    store_contract_id: contract.id,
    event_type: "success",
    amount: total,
    source: "contract_change",
    note: `アドオン購入(${lines.map((l) => `${l.addon.name}×${l.quantity}`).join("、")})`,
  });

  if (contract.contact_email) {
    try {
      const { sendPaymentReceiptEmail } = await import("@/lib/email");
      await sendPaymentReceiptEmail({
        to: contract.contact_email,
        storeName: store.name,
        amount: total,
        description: `アドオンのお申し込み（${lines.map((l) => (l.quantity > 1 ? `${l.addon.name}×${l.quantity}` : l.addon.name)).join("、")}）`,
        periodEnd: null,
        at: new Date(),
      });
    } catch {
      // 通知はベストエフォート
    }
  }

  // ここから先はお金を取れている。失敗しても止めずに、運営が直せるよう記録を残す。
  const periodEndIso = jstDateToIso(addMonths(todayJst(), 1));
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const orderId = orderIds[i];
    if (l.addon.billing_type !== "monthly") {
      await fulfillPaidAddonOrder(orderId);
      continue;
    }
    // fincode_subscription_id に OWN_BILLING を入れた行 = アドオン単独で毎月決済する行(cronが更新)
    const subscriptionId = OWN_BILLING;
    const subError: string | null = null;
    const { error: rowError } = await svc.from("store_contract_addons").insert({
      store_contract_id: contract.id,
      addon_id: l.addon.id,
      fee: l.unitPrice,
      billing_method: "card",
      current_period_end: periodEndIso,
      fincode_subscription_id: subscriptionId,
    });
    await svc
      .from("addon_orders")
      .update({
        status: l.addon.needs_fulfillment ? "paid" : "completed",
        completed_at: l.addon.needs_fulfillment ? null : nowIso,
        admin_note: subError || rowError ? `要確認: ${subError ? `毎月の課金設定に失敗(${subError})` : ""}${rowError ? ` 有効化に失敗(${rowError.message})` : ""}` : null,
      })
      .eq("id", orderId);
    if (l.addon.needs_fulfillment) await notifyAdmin(store.name, l.addon.name, 1, l.unitPrice, "card", params.note);
  }

  const monthlyNames = lines.filter((l) => l.addon.billing_type === "monthly").map((l) => l.addon.name);
  return `${total.toLocaleString("ja-JP")}円を決済しました。${
    monthlyNames.length ? `月額アドオン（${monthlyNames.join("、")}）は来月から毎月自動で決済されます。` : ""
  }`;
}


async function notifyAdmin(storeName: string, addonName: string, quantity: number, total: number, paymentMethod: string, note: string | null) {
  try {
    const { sendAddonOrderAdminEmail } = await import("@/lib/email");
    await sendAddonOrderAdminEmail({ storeName, addonName, quantity, total, paymentMethod, note });
  } catch {
    // ベストエフォート
  }
}

/** アドオン単独で毎月カード決済する行の目印(store_contract_addons.fincode_subscription_id に入れる) */
export const OWN_BILLING = "own_billing";

/** 月額アドオンの解約(期間の終わりで外す)。 */
export async function cancelMonthlyAddon(params: { storeId: string; storeContractAddonId: string }): Promise<string> {
  const svc = createServiceRoleClient();
  const { data: row } = await svc
    .from("store_contract_addons")
    .select("id, addon_id, billing_method, current_period_end, fincode_subscription_id, store_contracts!inner(store_id, current_period_end), addons(name)")
    .eq("id", params.storeContractAddonId)
    .maybeSingle();
  const c = (Array.isArray((row as any)?.store_contracts) ? (row as any).store_contracts[0] : (row as any)?.store_contracts) as
    | { store_id: string; current_period_end: string | null }
    | undefined;
  if (!row || c?.store_id !== params.storeId) throw new Error("アドオンが見つかりません。");
  const name = ((Array.isArray((row as any).addons) ? (row as any).addons[0] : (row as any).addons) as { name?: string } | null)?.name ?? "アドオン";

  let effectiveAt: string;
  if (row.billing_method === "bank_transfer") {
    effectiveAt = row.current_period_end ?? new Date().toISOString();
  } else if (row.fincode_subscription_id) {
    // アドオン単独で毎月決済している行: 次の決済をせず、支払い済みの期間の終わりまで使える
    // (cron は pending_removed_at のある行を更新しない)
    effectiveAt = row.current_period_end ?? new Date().toISOString();
  } else {
    effectiveAt = c.current_period_end ?? new Date().toISOString();
  }
  await svc.from("store_contract_addons").update({ pending_removed_at: effectiveAt }).eq("id", row.id);
  // 振込の更新請求がまだ未入金なら取り消す
  await svc.from("invoices").update({ status: "canceled" }).eq("store_contract_addon_id", row.id).eq("status", "unpaid");
  const d = new Date(Date.parse(effectiveAt) + 9 * 3600 * 1000);
  return `「${name}」の解約を受け付けました。${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日まではご利用いただけます。`;
}

/** 毎月自動更新される期間の、今日以降で最初の区切り(申込日から1か月ごと) */
export function nextPeriodEnd(firstPeriodEndIso: string | null) {
  if (!firstPeriodEndIso) return new Date().toISOString();
  let d = isoToJstDate(firstPeriodEndIso);
  const today = todayJst();
  for (let i = 0; i < 240 && d <= today; i++) d = addMonths(d, 1);
  return jstDateToIso(d);
}
