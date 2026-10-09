import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  addDays,
  createInvoice,
  getBillingSettings,
  isBillingCycle,
  isoToJstDate,
  sendInvoice,
  todayJst,
  type InvoiceRow,
} from "@/lib/bank-transfer";
import { sendSuspensionNoticeEmail } from "@/lib/email";

// ============================================================================
// 銀行振込の毎日の自動処理(2026/10新設。Vercel Cron、日本時間 毎朝9:00)
//  1) 次回分の請求書: 契約期間が終わる7日前になった振込契約に、次の期間の請求書を発行してメール送信
//  2) リマインド: お支払期限の前日の未入金請求書にメール
//  3) 未入金の停止: 期限を過ぎた契約の請求書(対象期間が始まっているもの)は店舗ページを非公開にする
//     (新規申込みの請求書は店舗がまだ無いので、運営が入金管理で確認・取消する)
// 入金確認で公開を戻す処理は lib/bank-transfer.ts confirmInvoicePayment。
// 認証: Authorization: Bearer $CRON_SECRET(Vercel Cronが自動で付与)
// ============================================================================

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const RENEWAL_LEAD_DAYS = 7;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type Result = { step: string; id: string; ok: boolean; detail?: string };

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const svc = createServiceRoleClient();
  const settings = await getBillingSettings(svc);
  const today = todayJst();
  const results: Result[] = [];

  // 1) 次回分の請求書 -----------------------------------------------------------
  const renewalCutoffIso = new Date(Date.parse(`${addDays(today, RENEWAL_LEAD_DAYS + 1)}T00:00:00+09:00`)).toISOString();
  const { data: dueContracts } = await svc
    .from("store_contracts")
    .select(
      "id, store_id, plan_id, pending_plan_id, pending_plan_effective_at, billing_cycle_months, current_period_end, contact_name, contact_email, stores(name)"
    )
    .eq("status", "active")
    .eq("billing_method", "bank_transfer")
    .not("current_period_end", "is", null)
    .lt("current_period_end", renewalCutoffIso);

  for (const c of dueContracts ?? []) {
    try {
      const periodStart = isoToJstDate(c.current_period_end as string);
      const { count } = await svc
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("store_contract_id", c.id)
        .eq("kind", "plan")
        .in("status", ["unpaid", "paid"])
        .gte("period_end", periodStart);
      if ((count ?? 0) > 0) continue; // この期間の請求書は発行済み

      const usePending =
        !!c.pending_plan_id && !!c.pending_plan_effective_at && isoToJstDate(c.pending_plan_effective_at as string) <= periodStart;
      const planId = (usePending ? c.pending_plan_id : c.plan_id) as string | null;
      if (!planId) throw new Error("プランが設定されていません。");
      const { data: plan } = await svc.from("plans").select("id, name, monthly_fee").eq("id", planId).maybeSingle();
      if (!plan) throw new Error("プランが見つかりません。");
      if (!c.contact_email) throw new Error("連絡先メールアドレスが未登録です。");
      const months = Number(c.billing_cycle_months);
      const store = Array.isArray(c.stores) ? c.stores[0] : c.stores;

      const invoice = await createInvoice({
        storeContractId: c.id,
        storeId: c.store_id,
        billToName: (store as { name?: string } | null)?.name ?? "店舗",
        billToContact: c.contact_name,
        billToEmail: c.contact_email,
        plan,
        months: isBillingCycle(months) ? months : 1,
        periodStart,
        settings,
      });
      try {
        await sendInvoice(invoice, settings, "renewal");
        results.push({ step: "renewal", id: invoice.id, ok: true });
      } catch (e) {
        results.push({ step: "renewal_email", id: invoice.id, ok: false, detail: e instanceof Error ? e.message : String(e) });
      }
    } catch (e) {
      results.push({ step: "renewal", id: c.id, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  // 2) 期限前日のリマインド -------------------------------------------------------
  const { data: remindInvoices } = await svc
    .from("invoices")
    .select("*")
    .eq("status", "unpaid")
    .eq("due_date", addDays(today, 1))
    .is("reminder_sent_at", null);
  for (const inv of (remindInvoices ?? []) as InvoiceRow[]) {
    try {
      await sendInvoice(inv, settings, "reminder");
      await svc.from("invoices").update({ reminder_sent_at: new Date().toISOString() }).eq("id", inv.id);
      results.push({ step: "reminder", id: inv.id, ok: true });
    } catch (e) {
      results.push({ step: "reminder", id: inv.id, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  // 3) 期限超過 → 店舗ページを非公開 ------------------------------------------------
  const { data: overdue } = await svc
    .from("invoices")
    .select("*")
    .eq("status", "unpaid")
    .lt("due_date", today)
    .eq("kind", "plan")
    .not("store_contract_id", "is", null);
  for (const inv of (overdue ?? []) as InvoiceRow[]) {
    // まだ支払い済みの期間が残っている(対象期間が始まっていない)うちは止めない
    if (inv.period_start && inv.period_start > today) continue;
    try {
      const { data: contract } = await svc
        .from("store_contracts")
        .select("id, store_id, suspended_for_nonpayment_at, contact_email, stores(name, status)")
        .eq("id", inv.store_contract_id!)
        .maybeSingle();
      if (!contract || contract.suspended_for_nonpayment_at) continue;
      const store = (Array.isArray(contract.stores) ? contract.stores[0] : contract.stores) as
        | { name?: string; status?: string }
        | null;
      const previousStatus = store?.status ?? null;
      if (previousStatus !== "approved" && previousStatus !== "listed") continue; // 既に非公開

      await svc
        .from("store_contracts")
        .update({ suspended_for_nonpayment_at: new Date().toISOString(), store_status_before_suspension: previousStatus })
        .eq("id", contract.id);
      await svc.from("stores").update({ status: "payment_suspended" }).eq("id", contract.store_id);
      await svc.from("invoices").update({ overdue_notified_at: new Date().toISOString() }).eq("id", inv.id);
      await svc.from("audit_log").insert({
        actor_user_id: null,
        actor_email: null,
        action: "store_suspended_for_nonpayment",
        target_type: "store",
        target_id: contract.store_id,
        detail: { invoiceId: inv.id, invoiceNumber: inv.invoice_number, previousStatus },
      });
      try {
        await sendSuspensionNoticeEmail({
          to: inv.bill_to_email,
          name: inv.bill_to_name,
          invoiceNumber: inv.invoice_number,
          amount: inv.total_amount,
        });
      } catch {
        // 通知はベストエフォート
      }
      results.push({ step: "suspend", id: inv.id, ok: true });
    } catch (e) {
      results.push({ step: "suspend", id: inv.id, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  // 4) 振込で払う月額アドオン ---------------------------------------------------------
  //  4a) 解約予約の期限が来たものを外す
  const nowIso = new Date().toISOString();
  const { data: removable } = await svc
    .from("store_contract_addons")
    .select("id")
    .eq("billing_method", "bank_transfer")
    .not("pending_removed_at", "is", null)
    .lte("pending_removed_at", nowIso);
  for (const r of removable ?? []) {
    await svc.from("store_contract_addons").delete().eq("id", r.id);
    results.push({ step: "addon_removed", id: r.id, ok: true });
  }

  //  4b) 期間終了の7日前に次の1か月分の請求書
  const { data: dueAddons } = await svc
    .from("store_contract_addons")
    .select("id, fee, current_period_end, store_contract_id, addons(name, monthly_fee), store_contracts!inner(id, status, store_id, contact_name, contact_email, stores(name))")
    .eq("billing_method", "bank_transfer")
    .is("pending_removed_at", null)
    .not("current_period_end", "is", null)
    .lt("current_period_end", renewalCutoffIso);
  for (const a of (dueAddons ?? []) as any[]) {
    try {
      const contract = Array.isArray(a.store_contracts) ? a.store_contracts[0] : a.store_contracts;
      if (!contract || contract.status !== "active" || !contract.contact_email) continue;
      const periodStart = isoToJstDate(a.current_period_end);
      const { count } = await svc
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("store_contract_addon_id", a.id)
        .in("status", ["unpaid", "paid"])
        .gte("period_end", periodStart);
      if ((count ?? 0) > 0) continue;
      const addon = Array.isArray(a.addons) ? a.addons[0] : a.addons;
      const store = Array.isArray(contract.stores) ? contract.stores[0] : contract.stores;
      const { createAddonInvoice } = await import("@/lib/addon-orders");
      const invoice = await createAddonInvoice({
        storeId: contract.store_id,
        storeContractId: contract.id,
        billToName: store?.name ?? "店舗",
        billToContact: contract.contact_name,
        billToEmail: contract.contact_email,
        lines: [{ addonName: addon?.name ?? "アドオン", unitPrice: a.fee ?? addon?.monthly_fee ?? 0, quantity: 1, monthly: true }],
        periodStart,
        storeContractAddonId: a.id,
      });
      results.push({ step: "addon_renewal", id: invoice.id, ok: true });
    } catch (e) {
      results.push({ step: "addon_renewal", id: a.id, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  //  4c) 更新分が期限を過ぎても未入金で、期間が切れたアドオンは外す
  const { data: overdueAddonInvoices } = await svc
    .from("invoices")
    .select("id, store_contract_addon_id, period_start, invoice_number")
    .eq("status", "unpaid")
    .eq("kind", "addon")
    .lt("due_date", today)
    .not("store_contract_addon_id", "is", null);
  for (const inv of overdueAddonInvoices ?? []) {
    if (inv.period_start && inv.period_start > today) continue;
    const { data: row } = await svc
      .from("store_contract_addons")
      .select("id, current_period_end")
      .eq("id", inv.store_contract_addon_id)
      .maybeSingle();
    if (!row) continue;
    if (row.current_period_end && row.current_period_end > nowIso) continue;
    await svc.from("store_contract_addons").delete().eq("id", row.id);
    await svc.from("invoices").update({ status: "canceled" }).eq("id", inv.id).eq("status", "unpaid");
    await svc.from("audit_log").insert({
      actor_user_id: null,
      actor_email: null,
      action: "addon_stopped_for_nonpayment",
      target_type: "invoice",
      target_id: inv.id,
      detail: { invoiceNumber: inv.invoice_number },
    });
    results.push({ step: "addon_stopped", id: inv.id, ok: true });
  }

  return NextResponse.json({ today, processed: results.length, results });
}
