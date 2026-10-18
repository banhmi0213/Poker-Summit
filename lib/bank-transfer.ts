// 銀行振込による支払い(2026/10)。請求書の作成・入金確認・未入金時の停止をまとめる。

/** お支払期限を過ぎてから掲載停止までの猶予日数(カード払いと同じ7日、2026/10) */
export const BANK_GRACE_DAYS = 7;
// DB: db/bank_transfer.sql。書き込みはすべてサーバー側の service-role で行う
// (呼び出し元で運営かどうか・本人かどうかを確認してから使うこと)。

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { addMonthsAnchored } from "@/lib/billing-dates";

export type BillingCycle = 1 | 6 | 12;
export const BILLING_CYCLES: BillingCycle[] = [1, 6, 12];

export type BankInfo = { bank: string; branch: string; type: string; number: string; holder: string };

export type PrepayDiscount = { type: "percent" | "free_months"; value: number };

export type BillingSettings = {
  bank: BankInfo | null;
  registrationNumber: string | null;
  dueDays: number;
  discounts: Record<string, PrepayDiscount | null | undefined>;
  cardPaymentEnabled: boolean;
};

export const DEFAULT_DISCOUNTS: Record<string, PrepayDiscount> = {
  "6": { type: "percent", value: 10 },
  "12": { type: "free_months", value: 2 },
};

export const ISSUER = {
  name: "株式会社Give Rise",
  service: "Poker Summit",
  address: "〒107-0062 東京都港区南青山3丁目1番36号 青山丸竹ビル6F",
  tel: "050-8886-6727",
  email: "info@pokersummit.jp",
};

export async function getBillingSettings(supabase: any = createServiceRoleClient()): Promise<BillingSettings> {
  const { data } = await supabase
    .from("site_settings")
    .select("bank_transfer_info, invoice_registration_number, transfer_due_days, prepay_discounts, card_payment_enabled")
    .eq("id", true)
    .maybeSingle();
  return {
    bank: (data?.bank_transfer_info as BankInfo | null) ?? null,
    registrationNumber: data?.invoice_registration_number ?? null,
    dueDays: Number(data?.transfer_due_days) || 7,
    discounts: (data?.prepay_discounts as BillingSettings["discounts"] | null) ?? DEFAULT_DISCOUNTS,
    cardPaymentEnabled: data?.card_payment_enabled !== false,
  };
}

export function isBillingCycle(n: number): n is BillingCycle {
  return n === 1 || n === 6 || n === 12;
}

/** まとめ払いの割引(周期ごと)。毎月払いは割引なし。 */
export function discountFor(settings: Pick<BillingSettings, "discounts">, months: BillingCycle): PrepayDiscount | null {
  if (months === 1) return null;
  const d = settings.discounts?.[String(months)];
  if (!d || !Number.isFinite(Number(d.value)) || Number(d.value) <= 0) return null;
  const value = Number(d.value);
  if (d.type === "percent" && value < 100) return { type: "percent", value };
  if (d.type === "free_months" && value < months) return { type: "free_months", value: Math.floor(value) };
  return null;
}

export function discountLabel(d: PrepayDiscount | null) {
  if (!d) return null;
  return d.type === "percent" ? `${d.value}%OFF` : `${d.value}か月分無料`;
}

/** 税込の請求額。消費税は内税10%(1円未満切り捨て)。割引は1円未満切り捨てで割引額を出す。 */
export function quote(monthlyFee: number, months: BillingCycle, discount: PrepayDiscount | null) {
  const gross = monthlyFee * months;
  const discountAmount = !discount
    ? 0
    : discount.type === "percent"
      ? Math.floor((gross * discount.value) / 100)
      : monthlyFee * discount.value;
  const total = gross - discountAmount;
  const tax = Math.floor((total * 10) / 110);
  return { gross, discountAmount, total, tax, label: discountLabel(discount) };
}

export function cycleLabel(months: number, label?: string | null) {
  if (months === 1) return "毎月払い";
  return `${months}か月まとめ払い${label ? `（${label}）` : ""}`;
}

// ---- 日付(日本時間の暦日で扱う) ------------------------------------------------
const JST = 9 * 60 * 60 * 1000;

/** 日本時間での今日 'YYYY-MM-DD' */
export function todayJst(now = new Date()) {
  return new Date(now.getTime() + JST).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' に nか月足した日(月末は月末に丸める)。毎月の更新日を保ちたいときは addMonthsAnchored を使う */
export function addMonths(date: string, months: number) {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** 日本時間のその日の 0:00 を ISO で(契約期間の終わりの保存用) */
export function jstDateToIso(date: string) {
  return new Date(Date.parse(`${date}T00:00:00+09:00`)).toISOString();
}

export function isoToJstDate(iso: string) {
  return new Date(Date.parse(iso) + JST).toISOString().slice(0, 10);
}

export function formatJpDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

// ---- 請求書 ---------------------------------------------------------------------

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  store_contract_id: string | null;
  listing_application_id: string | null;
  store_id: string | null;
  bill_to_name: string;
  bill_to_contact: string | null;
  bill_to_email: string;
  plan_id: string | null;
  plan_name: string;
  monthly_fee: number;
  months: number;
  discount_label: string | null;
  discount_amount: number;
  total_amount: number;
  tax_amount: number;
  period_start: string | null;
  period_end: string | null;
  issued_at: string;
  due_date: string;
  status: "unpaid" | "paid" | "canceled";
  paid_at: string | null;
  reminder_sent_at: string | null;
  overdue_notified_at: string | null;
  kind?: "plan" | "addon";
  items?: Array<{ label: string; sub?: string | null; quantity: string; unit_price: number; amount: number }> | null;
  addon_order_id?: string | null;
  store_contract_addon_id?: string | null;
};

export function isOverdue(invoice: Pick<InvoiceRow, "status" | "due_date">, today = todayJst()) {
  return invoice.status === "unpaid" && invoice.due_date < today;
}

export async function createInvoice(params: {
  storeContractId?: string | null;
  listingApplicationId?: string | null;
  storeId?: string | null;
  billToName: string;
  billToContact?: string | null;
  billToEmail: string;
  plan: { id: string; name: string; monthly_fee: number };
  months: BillingCycle;
  periodStart?: string | null; // 'YYYY-MM-DD'。新規申込みは入金確認日から始まるので null
  settings: BillingSettings;
  /** 毎月の更新日(store_contracts.billing_anchor_day)。31日始まりの契約が2月以降28日にずれないように */
  anchorDay?: number | null;
}): Promise<InvoiceRow> {
  const svc = createServiceRoleClient();
  // 金額の安全確認: 月額が正の整数でなければ請求書を作らない(0円・マイナス・小数の請求を防ぐ)
  if (!Number.isInteger(params.plan.monthly_fee) || params.plan.monthly_fee <= 0) {
    throw new Error(`プランの月額が正しくありません（${params.plan.monthly_fee}）。請求書は作成していません。`);
  }
  const q = quote(params.plan.monthly_fee, params.months, discountFor(params.settings, params.months));
  if (!Number.isInteger(q.total) || q.total <= 0 || q.total > params.plan.monthly_fee * params.months) {
    throw new Error(`請求金額の計算が正しくありません（${q.total}円）。請求書は作成していません。`);
  }
  const today = todayJst();
  const periodStart = params.periodStart ?? null;
  const { data, error } = await svc
    .from("invoices")
    .insert({
      store_contract_id: params.storeContractId ?? null,
      listing_application_id: params.listingApplicationId ?? null,
      store_id: params.storeId ?? null,
      bill_to_name: params.billToName,
      bill_to_contact: params.billToContact ?? null,
      bill_to_email: params.billToEmail,
      plan_id: params.plan.id,
      plan_name: params.plan.name,
      monthly_fee: params.plan.monthly_fee,
      months: params.months,
      discount_label: q.label,
      discount_amount: q.discountAmount,
      total_amount: q.total,
      tax_amount: q.tax,
      period_start: periodStart,
      period_end: periodStart ? addDays(addMonthsAnchored(periodStart, params.months, params.anchorDay ?? null), -1) : null,
      due_date: addDays(today, params.settings.dueDays),
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "請求書を作成できませんでした。");
  return data as InvoiceRow;
}

/** 請求書PDFを作ってメールで送る(ベストエフォート。失敗しても請求自体は残す)。 */
export async function sendInvoice(invoice: InvoiceRow, settings: BillingSettings, kind: "new" | "renewal" | "reminder") {
  const [{ buildInvoicePdf }, { sendInvoiceEmail }] = await Promise.all([
    import("@/lib/invoice-pdf"),
    import("@/lib/email"),
  ]);
  const pdf = await buildInvoicePdf(invoice, settings);
  await sendInvoiceEmail({ invoice, settings, pdf, kind });

  // LINE連携済みの店舗にはLINEでも知らせる(新規申込みでまだ店舗が無い場合は送らない)
  const { notifyStoreLine, PLAN_PAGE_URL, yen } = await import("@/lib/store-line");
  const due = formatJpDate(invoice.due_date);
  await notifyStoreLine(
    { storeId: invoice.store_id, contractId: invoice.store_contract_id },
    kind === "reminder"
      ? `明日（${due}）が請求書（${invoice.invoice_number}・${yen(invoice.total_amount)}）のお支払い期限です。お振込みをお願いします。\n${PLAN_PAGE_URL}`
      : `請求書（${invoice.invoice_number}・${yen(invoice.total_amount)}・お支払い期限${due}）をメールでお送りしました。\n${PLAN_PAGE_URL}`
  );
}

// ---- 入金確認 -------------------------------------------------------------------

/**
 * 運営が入金を確認したときの処理。
 * - 新規申込みの請求: 店舗・契約・ログインを発行(lib/store-provision.ts)
 * - 契約の請求(更新・プラン変更): 契約のプラン・期間を更新し、未入金で非公開にしていれば元に戻す
 * 呼び出し元で運営であることを確認してから呼ぶこと。
 */
export async function confirmInvoicePayment(invoiceId: string, adminUserId: string | null, note?: string) {
  const svc = createServiceRoleClient();
  const { data: invoice, error } = await svc.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (error || !invoice) throw new Error("請求書が見つかりません。");
  const inv = invoice as InvoiceRow;
  if (inv.status === "canceled") throw new Error("取り消し済みの請求書です。");
  if (inv.status === "paid") return { alreadyPaid: true as const };
  // 二重処理の防止: 「入金確認」が同時に2回押されても、店舗の発行・期間の延長は1回だけにする。
  // paid_at を先に入れた方だけが処理を続ける(失敗したら戻す)。
  {
    const { data: claimed } = await svc
      .from("invoices")
      .update({ paid_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("status", "unpaid")
      .is("paid_at", null)
      .select("id");
    if (!claimed?.length) return { alreadyPaid: true as const };
  }
  try {
    return await confirmClaimedInvoice(svc, inv, adminUserId, note);
  } catch (e) {
    await svc.from("invoices").update({ paid_at: null }).eq("id", invoiceId).eq("status", "unpaid");
    throw e;
  }
}

/** 請求期間の始まりが今の更新日どおりなら更新日を保ち、違えば(手動で今日から等)始まりの日を新しい更新日にする */
function keepAnchor(anchor: number | null, periodStart: string): number {
  const day = Number(periodStart.slice(8, 10));
  if (!anchor) return day;
  const [y, m] = periodStart.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.min(anchor, last) === day ? anchor : day;
}

async function confirmClaimedInvoice(svc: ReturnType<typeof createServiceRoleClient>, inv: InvoiceRow, adminUserId: string | null, note?: string) {

  if (inv.kind === "addon") {
    const { confirmAddonInvoice } = await import("@/lib/addon-orders");
    await confirmAddonInvoice(inv);
    const { error: paidErr } = await svc
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString(), confirmed_by: adminUserId, confirmed_note: note || null })
      .eq("id", inv.id)
      .eq("status", "unpaid");
    if (paidErr) throw new Error(paidErr.message);
    if (inv.store_contract_id) {
      await svc.from("billing_events").insert({
        store_contract_id: inv.store_contract_id,
        event_type: "success",
        amount: inv.total_amount,
        occurred_at: new Date().toISOString(),
        source: "bank_transfer",
        note: `請求書 ${inv.invoice_number}（アドオン: ${inv.plan_name}）`,
      });
    }
    await svc.from("audit_log").insert({
      actor_user_id: adminUserId,
      actor_email: null,
      action: "invoice_payment_confirmed",
      target_type: "invoice",
      target_id: inv.id,
      detail: { invoiceNumber: inv.invoice_number, amount: inv.total_amount, kind: "addon" },
    });
    return { alreadyPaid: false as const, storeId: inv.store_id, contractId: inv.store_contract_id };
  }

  const today = todayJst();
  const periodStart = inv.period_start ?? today;
  // 新規(請求書に期間が無い)は入金確認日から。更新日 = 期間の始まりの日
  const periodEnd = inv.period_end ?? addDays(addMonthsAnchored(periodStart, inv.months, null), -1);
  const anchorForNew = Number(periodStart.slice(8, 10));
  // 契約の current_period_end は「次の請求期間が始まる日」の0:00(JST)で持つ
  const nextPeriodStartIso = jstDateToIso(addDays(periodEnd, 1));

  let storeId = inv.store_id;
  let contractId = inv.store_contract_id;

  if (!contractId && inv.listing_application_id) {
    const { data: application } = await svc
      .from("listing_applications")
      .select("id, company_name, contact_name, email, tel, pref, category, plan_id, store_id")
      .eq("id", inv.listing_application_id)
      .maybeSingle();
    if (!application) throw new Error("申込みが見つかりません。");
    if (application.store_id) {
      storeId = application.store_id;
    } else {
      const { provisionPaidStoreFromApplication } = await import("@/lib/store-provision");
      const provisioned = await provisionPaidStoreFromApplication({
        application: { ...application, plan_id: inv.plan_id ?? application.plan_id },
        billing: {
          method: "bank_transfer",
          cycleMonths: inv.months,
          currentPeriodEndIso: nextPeriodStartIso,
          anchorDay: anchorForNew,
        },
      });
      storeId = provisioned.storeId;
    }
    const { data: contract } = await svc.from("store_contracts").select("id").eq("store_id", storeId).maybeSingle();
    contractId = contract?.id ?? null;
  } else if (contractId) {
    const { data: contract } = await svc
      .from("store_contracts")
      .select("id, store_id, suspended_for_nonpayment_at, store_status_before_suspension, billing_anchor_day")
      .eq("id", contractId)
      .maybeSingle();
    if (!contract) throw new Error("契約が見つかりません。");
    storeId = contract.store_id;
    const { error: updateError } = await svc
      .from("store_contracts")
      .update({
        status: "active",
        plan_id: inv.plan_id,
        billing_method: "bank_transfer",
        billing_cycle_months: inv.months,
        current_period_end: nextPeriodStartIso,
        billing_anchor_day: keepAnchor(contract.billing_anchor_day as number | null, periodStart),
        pending_plan_id: null,
        pending_plan_effective_at: null,
        canceled_at: null,
        last_billing_status: "success",
        last_billing_at: new Date().toISOString(),
        suspended_for_nonpayment_at: null,
        store_status_before_suspension: null,
      })
      .eq("id", contractId);
    if (updateError) throw new Error(updateError.message);
    if (contract.suspended_for_nonpayment_at) {
      await svc
        .from("stores")
        .update({ status: contract.store_status_before_suspension || "approved" })
        .eq("id", contract.store_id)
        .eq("status", "payment_suspended");
    }
  }

  const { error: paidError } = await svc
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      confirmed_by: adminUserId,
      confirmed_note: note || null,
      store_id: storeId,
      store_contract_id: contractId,
      period_start: periodStart,
      period_end: periodEnd,
    })
    .eq("id", inv.id)
    .eq("status", "unpaid");
  if (paidError) throw new Error(paidError.message);

  if (contractId) {
    await svc.from("billing_events").insert({
      store_contract_id: contractId,
      event_type: "success",
      amount: inv.total_amount,
      occurred_at: new Date().toISOString(),
      source: "bank_transfer",
      note: `請求書 ${inv.invoice_number}（${inv.plan_name}・${cycleLabel(inv.months, inv.discount_label)}）`,
    });
  }

  await svc.from("audit_log").insert({
    actor_user_id: adminUserId,
    actor_email: null,
    action: "invoice_payment_confirmed",
    target_type: "invoice",
    target_id: inv.id,
    detail: { invoiceNumber: inv.invoice_number, amount: inv.total_amount, storeId, contractId },
  });

  {
    const { notifyStoreLine, yen } = await import("@/lib/store-line");
    await notifyStoreLine(
      { storeId, contractId },
      `ご入金（請求書 ${inv.invoice_number}・${yen(inv.total_amount)}）を確認しました。ありがとうございます。`
    );
  }

  return { alreadyPaid: false as const, storeId, contractId };
}

export async function cancelInvoice(invoiceId: string, adminUserId: string | null): Promise<{ canceled: boolean; reason?: string }> {
  const svc = createServiceRoleClient();
  // 入金確認の処理中(paid_at が入っている)・入金済み・取消済みのものは取り消さない
  const { data: canceled, error } = await svc
    .from("invoices")
    .update({ status: "canceled" })
    .eq("id", invoiceId)
    .eq("status", "unpaid")
    .is("paid_at", null)
    .select("id, addon_order_id, invoice_number");
  if (error) throw new Error(error.message);
  if (!canceled?.length) {
    const { data: inv } = await svc.from("invoices").select("status, paid_at").eq("id", invoiceId).maybeSingle();
    if (!inv) return { canceled: false, reason: "請求書が見つかりません。" };
    if (inv.status === "paid") return { canceled: false, reason: "入金確認済みの請求書は取り消せません。" };
    if (inv.status === "canceled") return { canceled: false, reason: "この請求書はすでに取り消されています。" };
    return { canceled: false, reason: "入金確認の処理中のため取り消せませんでした。少し待ってから画面を更新してください。" };
  }
  // アドオン注文の請求なら注文も取り消す(1枚にまとめた複数の注文も)
  const addonOrderId = canceled[0].addon_order_id as string | null;
  await svc.from("addon_orders").update({ status: "canceled" }).eq("invoice_id", invoiceId).eq("status", "awaiting_payment");
  if (addonOrderId) {
    await svc.from("addon_orders").update({ status: "canceled" }).eq("id", addonOrderId).eq("status", "awaiting_payment");
  }
  await svc.from("audit_log").insert({
    actor_user_id: adminUserId,
    actor_email: null,
    action: "invoice_canceled",
    target_type: "invoice",
    target_id: invoiceId,
    detail: { invoiceNumber: canceled[0].invoice_number },
  });
  return { canceled: true };
}
