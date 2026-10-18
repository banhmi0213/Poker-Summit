import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { reconcileAttempt } from "@/lib/payment-ledger";

// 結果不明だったカード決済を確かめて、続きの処理を行う(総合管理 > 決済の監視、2026/10/18)。
// 新たに決済はしない。KOMOJUで「決済済み」なら、その決済を使って反映する(同じ支払いとして扱うので二重にならない)。

export async function resolveAndResume(attemptId: string, adminUserId: string | null): Promise<string> {
  const svc = createServiceRoleClient();
  const r = await reconcileAttempt(attemptId, adminUserId);
  const { data: row } = await svc.from("payment_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (!row) throw new Error("決済の記録が見つかりません。");
  const ctx = (row.context ?? {}) as Record<string, any>;

  if (r.status === "unknown") return `まだ確定していません（${r.detail}）。少し時間をおいてもう一度確認してください。`;

  if (r.status === "failed") {
    if (row.purpose === "apply" && row.listing_application_id) {
      await svc
        .from("listing_applications")
        .update({ payment_status: "failed", payment_note: "KOMOJUで未決済を確認(結果不明から確定)" })
        .eq("id", row.listing_application_id)
        .in("payment_status", ["charge_unknown", "processing"]);
    }
    if (row.purpose === "addon_purchase" && Array.isArray(ctx.orderIds)) {
      await svc.from("addon_orders").update({ status: "canceled", admin_note: "カード決済されていなかったため取消" }).in("id", ctx.orderIds).eq("status", "awaiting_payment");
    }
    return "KOMOJUでは決済されていませんでした。お金は動いていません。" + (row.purpose === "renewal" || row.purpose === "addon_renewal" ? "次の自動処理で改めて決済します。" : "");
  }

  // 決済済み → 続きの処理
  switch (row.purpose) {
    case "renewal":
    case "addon_renewal":
      return "KOMOJUで決済済みでした。次の自動処理(毎日 午前3時)で、決済し直さずに契約期間を延長します。";
    case "change": {
      const { applyContractBillingChange } = await import("@/lib/contracts-billing");
      const p = ctx.params as any;
      await applyContractBillingChange({ ...p, groupKeyOverride: row.group_key });
      return "KOMOJUで決済済みでした。プラン・アドオンの変更を反映しました（決済し直していません）。";
    }
    case "upgrade": {
      const { applyProratedPlanUpgrade } = await import("@/lib/contracts-billing");
      const p = ctx.params as any;
      await applyProratedPlanUpgrade({ storeContractId: p.storeContractId, newPlanId: p.newPlanId, groupKeyOverride: row.group_key });
      return "KOMOJUで決済済みでした。プランの変更を反映しました（決済し直していません）。";
    }
    case "addon_purchase": {
      const { finalizeCardAddonOrders } = await import("@/lib/addon-orders");
      const msg = await finalizeCardAddonOrders({ orderIds: ctx.orderIds ?? [], attemptId: row.id, amount: row.amount, storeId: row.store_id, note: ctx.note ?? null });
      return `KOMOJUで決済済みでした。アドオンを有効にしました。（${msg}）`;
    }
    case "apply": {
      return provisionPaidApplication(row.listing_application_id as string, row.customer_id as string);
    }
    default:
      return "KOMOJUで決済済みでした。";
  }
}

/** 決済済みの新規申込みで店舗を発行する(何度押しても店舗は1つ。lib/store-provision.ts) */
export async function provisionPaidApplication(applicationId: string, customerId: string | null): Promise<string> {
  const svc = createServiceRoleClient();
  const { data: paid } = await svc
    .from("payment_attempts")
    .select("id")
    .eq("group_key", `apply:${applicationId}`)
    .eq("status", "captured")
    .maybeSingle();
  if (!paid) throw new Error("この申込みの決済済みの記録がありません。店舗は発行していません。");
  const { data: application } = await svc
    .from("listing_applications")
    .select("id, company_name, contact_name, email, tel, pref, category, plan_id, fincode_customer_id, payment_status")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) throw new Error("申込みが見つかりません。");
  if (application.payment_status === "active") return "この申込みの店舗はすでに発行済みです。";
  const { provisionPaidStoreFromApplication } = await import("@/lib/store-provision");
  try {
    await provisionPaidStoreFromApplication({
      application,
      fincodeCustomerId: customerId ?? (application.fincode_customer_id?.startsWith("session:") ? null : application.fincode_customer_id),
      fincodeSubscriptionId: null,
    });
  } catch (e) {
    await svc
      .from("listing_applications")
      .update({ payment_status: "charged_pending_manual", payment_note: `店舗の発行でエラー: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) })
      .eq("id", applicationId);
    throw e;
  }
  return "店舗・ログインを発行し、ログイン情報をメールで送りました。";
}
