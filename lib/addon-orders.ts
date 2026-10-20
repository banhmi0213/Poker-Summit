// アドオンの購入(2026/10)。カードはその場で決済、銀行振込は請求書を発行して入金確認で有効化。
//  月額(カード): 初月分をその場で決済し、2か月目からはアドオンごとのサブスクで毎月課金(プラン料金は取り直さない)
//  月額(振込): アドオンごとに1か月分の請求書。入金確認で有効化し、期間終了の7日前に次の請求書(cron)
//  都度: スポット求人1件掲載は追加掲載枠を付与。制作系は運営が対応(総合管理「アドオン注文」)
// 書き込みは service-role。呼び出し元で店舗オーナー/運営の確認を済ませること。

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { addonFeeFor, type AddonRow, ADDON_COLUMNS } from "@/lib/addons";
import { addMonthsAnchored, freshPeriodEnd, jstMidnightIso } from "@/lib/billing-dates";
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
  /** 月額の更新分: 毎月の更新日(store_contract_addons.billing_anchor_day) */
  anchorDay?: number | null;
}): Promise<InvoiceRow> {
  const svc = createServiceRoleClient();
  const settings = await getBillingSettings(svc);
  if (!params.lines.length) throw new Error("請求する内容がありません。");
  for (const l of params.lines) {
    if (!Number.isInteger(l.unitPrice) || l.unitPrice <= 0 || !Number.isInteger(l.quantity) || l.quantity <= 0) {
      throw new Error(`アドオンの金額・数量が正しくありません（${l.addonName}：${l.unitPrice}円×${l.quantity}）。請求書は作成していません。`);
    }
  }
  const total = params.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const periodStart = params.periodStart ?? null;
  const periodEnd = periodStart ? addDays(addMonthsAnchored(periodStart, 1, params.anchorDay ?? null), -1) : null;
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
    const { alertAdmin } = await import("@/lib/admin-alert");
    await alertAdmin("請求書メールを送れませんでした", [`請求書 ${(data as InvoiceRow).invoice_number}（${params.billToName}・${params.billToEmail}）`, `内容: ${e instanceof Error ? e.message : String(e)}`, "入金管理の「メールで再送」から送り直してください。"], "/admin/billing");
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
    const fresh = freshPeriodEnd(); // 日本時間の今日から1か月(更新日 = 今日の日付)
    const periodEndIso = fresh.periodEndIso;
    const { data: existing } = await svc
      .from("store_contract_addons")
      .select("id")
      .eq("store_contract_id", o.store_contract_id)
      .eq("addon_id", o.addon_id)
      .maybeSingle();
    if (existing) {
      await svc
        .from("store_contract_addons")
        .update({ current_period_end: periodEndIso, billing_anchor_day: fresh.anchorDay, pending_removed_at: null, billing_method: "bank_transfer", fee: o.unit_price })
        .eq("id", existing.id);
    } else {
      const { error } = await svc.from("store_contract_addons").insert({
        store_contract_id: o.store_contract_id,
        addon_id: o.addon_id,
        fee: o.unit_price,
        billing_method: "bank_transfer",
        current_period_end: periodEndIso,
        billing_anchor_day: fresh.anchorDay,
      });
      if (error) throw new Error(error.message);
    }
    await svc.from("addon_orders").update({ status: "completed", paid_at: o.paid_at ?? nowIso, completed_at: nowIso }).eq("id", o.id);
    return;
  }

  if (o.addon_code === "dealer_scout") {
    const { error } = await svc.rpc("fulfill_dealer_scout_order", { p_order_id: o.id });
    if (error) throw new Error(error.message);
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
      .select("id, current_period_end, billing_anchor_day")
      .eq("id", inv.store_contract_addon_id)
      .maybeSingle();
    const start = inv.period_start ?? (row?.current_period_end ? isoToJstDate(row.current_period_end) : todayJst());
    // 更新日(billing_anchor_day)を変えずに1か月(31日始まりでも 2月で28日にずれたままにならない)
    const nextIso = jstMidnightIso(addMonthsAnchored(start, 1, (row as any)?.billing_anchor_day ?? null));
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
  /** 画面を開いたときに作る番号。同じ画面からの二重送信を見分ける */
  requestKey?: string | null;
}): Promise<string> {
  const svc = createServiceRoleClient();
  if (!params.items.length) throw new Error("お申し込みするアドオンを選んでください。");

  const [{ data: contract }, { data: store }, settings, { data: addonRows }] = await Promise.all([
    svc
      .from("store_contracts")
      .select("id, status, cancel_at_period_end, plan_id, fincode_customer_id, contact_name, contact_email, store_contract_addons(id, addon_id, billing_method, pending_removed_at)")
      .eq("store_id", params.storeId)
      .maybeSingle(),
    svc.from("stores").select("id, name, pref").eq("id", params.storeId).maybeSingle(),
    getBillingSettings(svc),
    svc.from("addons").select(ADDON_COLUMNS).in("id", params.items.map((i) => i.addonId)),
  ]);
  if (!contract || contract.status !== "active") throw new Error("有効な契約がありません。運営にお問い合わせください。");
  if ((contract as any).cancel_at_period_end) throw new Error("解約のご予定があるため、アドオンのお申し込みはできません。解約を取り消す場合は運営にお問い合わせください。");
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
        : Math.max(1, Math.min(["spot_job_credit", "dealer_scout"].includes(addon.code ?? "") ? 50 : 5, Math.floor(item.quantity || 1)));
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
    // 請求書を作れなかったときは注文を取り消す(入金待ちのまま残って、申し込み直せなくなるのを防ぐ)
    let invoice: InvoiceRow;
    try {
      invoice = await createAddonInvoice({
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
    } catch (e) {
      await svc
        .from("addon_orders")
        .update({ status: "canceled", admin_note: `請求書の作成に失敗したため取消: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) })
        .in("id", orderIds)
        .eq("status", "awaiting_payment");
      throw new Error("請求書を作成できませんでした。お手数ですが、もう一度お試しいただくか運営にお問い合わせください。");
    }
    const { error: linkError } = await svc.from("addon_orders").update({ invoice_id: invoice.id }).in("id", orderIds);
    if (linkError) {
      const { alertAdmin } = await import("@/lib/admin-alert");
      await alertAdmin("アドオンの注文と請求書を結び付けられませんでした", [`${store.name}・請求書 ${invoice.invoice_number}`, `内容: ${linkError.message}`, "入金確認の前に、総合管理の「アドオン注文」で確認してください。"], "/admin/addon-orders");
    }
    return `請求書（${invoice.total_amount.toLocaleString("ja-JP")}円）をメールでお送りしました。ご入金の確認後にご利用いただけます。`;
  }

  // ---- カード: 選んだアドオンの合計だけを1回で決済(プラン料金は含めない) ----
  //  月額アドオンは初月分をここで決済し、2か月目からは cron(apply-scheduled-contract-changes)が
  //  アドオンごとの契約期間(current_period_end)の終わりに同じカードへ決済する。
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  // 何の支払いか(二重請求の防止。lib/payment-ledger.ts):
  //  月額を含む: 「この店舗の、今日の、この月額アドオンの申込み」(別の画面から同時に申し込んでも1回だけ)
  //  都度のみ: 「この画面からの申込み」(連打・二重送信でも1回だけ。別の機会の追加購入はできる)
  const { createHash, randomUUID } = await import("crypto");
  const { jstToday } = await import("@/lib/billing-dates");
  const monthlyIds = lines.filter((l) => l.addon.billing_type === "monthly").map((l) => l.addon.id).sort();
  const lineSig = createHash("sha256").update(lines.map((l) => `${l.addon.id}x${l.quantity}`).sort().join(",")).digest("hex").slice(0, 16);
  const groupKey = monthlyIds.length
    ? `addon_purchase:${params.storeId}:${jstToday()}:${lineSig}`
    : `addon_purchase:${params.storeId}:${(params.requestKey || randomUUID()).slice(0, 64)}:${lineSig}`;

  {
    const { data: done } = await svc.from("addon_orders").select("id, status").eq("payment_group_key", groupKey).neq("status", "canceled");
    if ((done ?? []).some((o: any) => o.status !== "awaiting_payment")) return "このお申し込みはすでに受け付けています（二重には決済していません）。";
    if ((done ?? []).length) throw new Error("同じお申し込みを処理中、またはお支払いの結果を確認中です。二重には決済していません。しばらくしてから画面を更新してご確認ください。");
  }

  const orderIds: string[] = [];
  for (const l of lines) orderIds.push(await insertOrder(l, { status: "awaiting_payment", payment_group_key: groupKey }));
  const { chargeOnce } = await import("@/lib/payment-ledger");
  const charge = await chargeOnce({
    purpose: "addon_purchase",
    groupKey,
    customerId: contract.fincode_customer_id!,
    amount: total,
    refs: { storeContractId: contract.id, storeId: params.storeId },
    context: { kind: "addon_purchase", orderIds, note: params.note },
    description: `アドオン購入（${store.name}・${lines.map((l) => `${l.addon.name}×${l.quantity}`).join("、")}）`,
  });
  if (charge.status === "BUSY") {
    // 同じ申込みを別のリクエストが処理中(二重送信)。こちらで作った注文は取り消す
    await svc.from("addon_orders").update({ status: "canceled", admin_note: "二重送信のため取消(決済は1回のみ)" }).in("id", orderIds);
    throw new Error("同じお申し込みを処理中、またはお支払いの結果を確認中です。二重には決済していません。しばらくしてから画面を更新してご確認ください。");
  }
  if (charge.status === "UNKNOWN") {
    await svc.from("addon_orders").update({ admin_note: "要確認: カード決済の結果不明(総合管理の決済の監視から確認)" }).in("id", orderIds);
    throw new Error("お支払いの結果を確認しています。二重にお支払いいただくことがないよう、運営で確認してからご連絡します。");
  }
  if (charge.status === "FAILED") {
    await svc
      .from("addon_orders")
      .update({ status: "canceled", admin_note: `カード決済失敗: ${charge.error}`.slice(0, 500) })
      .in("id", orderIds);
    throw new Error("カード決済が完了しませんでした。カード情報をご確認いただくか、銀行振込をお選びください。");
  }
  if (charge.replayed) {
    // ありえないはずだが、決済済みの申込みに注文を重ねて作らない
    await svc.from("addon_orders").update({ status: "canceled", admin_note: "決済済みの申込みと重複のため取消" }).in("id", orderIds);
    return "このお申し込みはすでに受け付けています（二重には決済していません）。";
  }
  return finalizeCardAddonOrders({ orderIds, attemptId: charge.attemptId, amount: charge.amount, storeId: params.storeId, note: params.note });
}

/**
 * カード決済できたアドオン注文を有効にする(購入時、または結果不明を運営が「決済済み」と確認したあと)。
 * awaiting_payment の注文だけを対象にするので、2回呼んでも二重にはならない。
 */
export async function finalizeCardAddonOrders(params: { orderIds: string[]; attemptId: string; amount: number; storeId: string; note: string | null }): Promise<string> {
  const svc = createServiceRoleClient();
  const nowIso = new Date().toISOString();
  // 対象の注文を「決済済み」に確保(同時に呼ばれても片方だけが進む)
  const { data: claimed } = await svc
    .from("addon_orders")
    .update({ fincode_order_id: params.attemptId, paid_at: nowIso, status: "paid", admin_note: null })
    .in("id", params.orderIds)
    .eq("status", "awaiting_payment")
    .select("id, addon_id, addon_name, quantity, unit_price, billing_type, store_contract_id");
  const orders = (claimed ?? []) as Array<{ id: string; addon_id: string | null; addon_name: string; quantity: number; unit_price: number; billing_type: string; store_contract_id: string | null }>;
  if (!orders.length) return "このお申し込みはすでに受け付けています（二重には決済していません）。";
  const contractId = orders[0].store_contract_id;
  const [{ data: store }, { data: contract }] = await Promise.all([
    svc.from("stores").select("name").eq("id", params.storeId).maybeSingle(),
    contractId ? svc.from("store_contracts").select("id, contact_email").eq("id", contractId).maybeSingle() : Promise.resolve({ data: null as any }),
  ]);
  const storeName = (store?.name as string | undefined) ?? "店舗";
  const label = orders.map((o) => (o.quantity > 1 ? `${o.addon_name}×${o.quantity}` : o.addon_name)).join("、");

  await svc.from("billing_events").insert({
    store_contract_id: contractId,
    event_type: "success",
    amount: params.amount,
    source: "contract_change",
    note: `アドオン購入(${orders.map((o) => `${o.addon_name}×${o.quantity}`).join("、")})`,
  });

  if (contract?.contact_email) {
    try {
      const { sendPaymentReceiptEmail } = await import("@/lib/email");
      await sendPaymentReceiptEmail({
        to: contract.contact_email,
        storeName,
        amount: params.amount,
        description: `アドオンのお申し込み（${label}）`,
        periodEnd: null,
        at: new Date(),
      });
    } catch {
      // 通知はベストエフォート
    }
  }
  {
    const { notifyStoreLine, PLAN_PAGE_URL, yen } = await import("@/lib/store-line");
    await notifyStoreLine({ storeId: params.storeId }, `${yen(params.amount)}のカード決済が完了しました（アドオン：${orders.map((o) => o.addon_name).join("、")}）。\n${PLAN_PAGE_URL}`);
  }

  // ここから先はお金を取れている。失敗しても止めずに、運営が直せるよう記録を残す。
  const { freshPeriodEnd } = await import("@/lib/billing-dates");
  const period = freshPeriodEnd();
  const addonIds = orders.map((o) => o.addon_id).filter(Boolean) as string[];
  const { data: addonRows } = addonIds.length ? await svc.from("addons").select(ADDON_COLUMNS).in("id", addonIds) : { data: [] as any[] };
  for (const o of orders) {
    const addon = ((addonRows ?? []) as AddonRow[]).find((a) => a.id === o.addon_id);
    if (o.billing_type !== "monthly") {
      await fulfillPaidAddonOrder(o.id);
      continue;
    }
    // fincode_subscription_id に OWN_BILLING を入れた行 = アドオン単独で毎月決済する行(cronが更新)
    const { error: rowError } = await svc.from("store_contract_addons").insert({
      store_contract_id: contractId,
      addon_id: o.addon_id,
      fee: o.unit_price,
      billing_method: "card",
      current_period_end: period.periodEndIso,
      billing_anchor_day: period.anchorDay,
      fincode_subscription_id: OWN_BILLING,
    });
    const needsFulfillment = !!addon?.needs_fulfillment;
    await svc
      .from("addon_orders")
      .update({
        status: needsFulfillment ? "paid" : "completed",
        completed_at: needsFulfillment ? null : nowIso,
        admin_note: rowError ? `要確認: 有効化に失敗(${rowError.message})` : null,
      })
      .eq("id", o.id);
    if (rowError) {
      const { alertAdmin } = await import("@/lib/admin-alert");
      await alertAdmin("決済済みのアドオンを有効にできませんでした", [`${storeName}・${o.addon_name}`, `内容: ${rowError.message}`, "総合管理の「アドオン注文」から確認してください。"], "/admin/addon-orders");
    }
    if (needsFulfillment) await notifyAdmin(storeName, o.addon_name, 1, o.unit_price, "card", params.note);
  }

  const monthlyNames = orders.filter((o) => o.billing_type === "monthly").map((o) => o.addon_name);
  return `${params.amount.toLocaleString("ja-JP")}円を決済しました。${
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
