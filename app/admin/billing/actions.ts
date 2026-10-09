"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  cancelInvoice,
  confirmInvoicePayment,
  createInvoice,
  getBillingSettings,
  isBillingCycle,
  isoToJstDate,
  sendInvoice,
  todayJst,
  type InvoiceRow,
} from "@/lib/bank-transfer";

const BILLING_PATH = "/admin/billing";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインしてください。");
  const { data: adminRow } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) throw new Error("運営権限がありません。");
  return user;
}

function back(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  redirect(`${BILLING_PATH}${q ? `?${q}` : ""}`);
}

export async function confirmPaymentAction(formData: FormData) {
  const user = await requireAdmin();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  let message = "";
  try {
    const result = await confirmInvoicePayment(invoiceId, user.id, note || undefined);
    message = result.alreadyPaid ? "この請求書はすでに入金確認済みです。" : "入金を確認しました。";
  } catch (e) {
    back({ error: e instanceof Error ? e.message : String(e) });
  }
  revalidatePath(BILLING_PATH);
  back({ ok: message });
}

export async function cancelInvoiceAction(formData: FormData) {
  const user = await requireAdmin();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  try {
    await cancelInvoice(invoiceId, user.id);
  } catch (e) {
    back({ error: e instanceof Error ? e.message : String(e) });
  }
  revalidatePath(BILLING_PATH);
  back({ ok: "請求書を取り消しました。" });
}

export async function resendInvoiceAction(formData: FormData) {
  await requireAdmin();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const svc = createServiceRoleClient();
  const { data: invoice } = await svc.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) back({ error: "請求書が見つかりません。" });
  let error: string | null = null;
  try {
    const settings = await getBillingSettings();
    const inv = invoice as InvoiceRow;
    await sendInvoice(inv, settings, inv.listing_application_id && !inv.store_contract_id ? "new" : "renewal");
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  if (error) back({ error: `メール送信に失敗しました: ${error}` });
  back({ ok: "請求書をメールで再送しました。" });
}

/** 契約中の店舗に請求書を発行(プラン変更・カード払いからの切替・まとめ払いへの変更など)。 */
export async function issueInvoiceAction(formData: FormData) {
  const user = await requireAdmin();
  const contractId = String(formData.get("contractId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const months = Number(formData.get("months") ?? 1);
  const startMode = String(formData.get("startMode") ?? "next");
  if (!contractId || !planId || !isBillingCycle(months)) back({ error: "契約・プラン・支払いサイクルを選んでください。" });

  const svc = createServiceRoleClient();
  const { data: contract } = await svc
    .from("store_contracts")
    .select("id, store_id, contact_name, contact_email, current_period_end, stores(name)")
    .eq("id", contractId)
    .maybeSingle();
  const { data: plan } = await svc.from("plans").select("id, name, monthly_fee").eq("id", planId).maybeSingle();
  if (!contract || !plan) back({ error: "契約またはプランが見つかりません。" });
  const email = contract!.contact_email as string | null;
  if (!email) back({ error: "契約に連絡先メールアドレスが登録されていません。契約店舗の画面で登録してください。" });

  const today = todayJst();
  const nextStart = contract!.current_period_end ? isoToJstDate(contract!.current_period_end) : today;
  const periodStart = startMode === "today" || nextStart < today ? today : nextStart;
  const storeName = (Array.isArray(contract!.stores) ? contract!.stores[0] : contract!.stores)?.name ?? "店舗";

  let invoice: InvoiceRow | null = null;
  let error: string | null = null;
  try {
    const settings = await getBillingSettings();
    invoice = await createInvoice({
      storeContractId: contract!.id,
      storeId: contract!.store_id,
      billToName: storeName,
      billToContact: contract!.contact_name,
      billToEmail: email!,
      plan,
      months,
      periodStart,
      settings,
    });
    await svc.from("audit_log").insert({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "invoice_issued_manual",
      target_type: "invoice",
      target_id: invoice.id,
      detail: { contractId, planId, months, periodStart },
    });
    await sendInvoice(invoice, settings, "renewal");
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  revalidatePath(BILLING_PATH);
  if (error) back({ error: invoice ? `請求書は作成しましたが、メール送信に失敗しました: ${error}` : error });
  back({ ok: `請求書 ${invoice!.invoice_number} を発行し、${email} に送信しました。` });
}

export async function updateBillingSettingsAction(formData: FormData) {
  const user = await requireAdmin();
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const discount = (months: string) => {
    const type = s(`discount${months}Type`);
    const value = Number(s(`discount${months}Value`));
    if (type === "none" || !Number.isFinite(value) || value <= 0) return null;
    return { type: type === "free_months" ? "free_months" : "percent", value };
  };
  const dueDays = parseInt(s("dueDays"), 10);
  const payload = {
    bank_transfer_info: {
      bank: s("bank"),
      branch: s("branch"),
      type: s("accountType") || "普通",
      number: s("number"),
      holder: s("holder"),
    },
    invoice_registration_number: s("registrationNumber") || null,
    transfer_due_days: Number.isFinite(dueDays) && dueDays > 0 && dueDays <= 60 ? dueDays : 7,
    prepay_discounts: { "6": discount("6"), "12": discount("12") },
    card_payment_enabled: formData.get("cardPaymentEnabled") === "on",
  };
  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").update(payload).eq("id", true);
  if (error) back({ error: error.message, tab: "settings" });
  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    actor_email: user.email ?? null,
    action: "billing_settings_update",
    target_type: "site_settings",
    target_id: "billing",
    detail: payload,
  });
  revalidatePath(BILLING_PATH);
  revalidatePath("/apply");
  back({ ok: "振込・請求の設定を保存しました。", tab: "settings" });
}
