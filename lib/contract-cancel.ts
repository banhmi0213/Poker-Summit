import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { jstDateOf, jpDateLabel } from "@/lib/billing-dates";
import { notifyStoreLine } from "@/lib/store-line";
import { revalidatePublicData } from "@/lib/revalidate";

// ============================================================================
// 契約の解約(2026/10/18、ユーザー指示「解約時は満期で店舗ページ削除、総合からも削除」)。
// 1. 解約を受け付けると(scheduleContractCancel)、契約期間の終わりまでは今までどおり使える。
//    次の期間の請求(カード更新・振込の請求書・アドオン更新)は行わず、発行済みで未入金の
//    次の期間の請求書は取り消す。
// 2. 契約期間の終わりに、毎日の自動処理(cron)が終了処理(finalizeContractCancel)を行う:
//    契約を「解約済み」、店舗を status='closed'(公開ページ・総合管理の店舗一覧から消える)、
//    店舗管理のログインを削除、LINE連携を解除、クーポン・イベント・求人などを非公開。
//    請求書・入金・決済の記録は税法上の保存のため消さない(入金管理・契約の画面には残る)。
// ============================================================================

export async function scheduleContractCancel(contractId: string, actorUserId: string | null): Promise<string> {
  const svc = createServiceRoleClient();
  const { data: c } = await svc.from("store_contracts").select("id, store_id, status, current_period_end, cancel_at_period_end").eq("id", contractId).maybeSingle();
  if (!c) throw new Error("契約が見つかりません。");
  if (c.status !== "active") throw new Error("この契約はすでに終了しています。");
  const nowIso = new Date().toISOString();
  await svc
    .from("store_contracts")
    .update({ cancel_at_period_end: true, cancel_requested_at: nowIso, pending_plan_id: null, pending_plan_effective_at: null, updated_at: nowIso })
    .eq("id", contractId);

  // 次の期間(契約期間の終わり以降)の未入金の請求書を取り消す。今の期間の未入金分は取り消さない(利用した分)
  const periodStartOfNext = c.current_period_end ? jstDateOf(c.current_period_end as string) : null;
  if (periodStartOfNext) {
    await svc.from("invoices").update({ status: "canceled" }).eq("store_contract_id", contractId).eq("status", "unpaid").is("paid_at", null).gte("period_start", periodStartOfNext);
  }
  await svc.from("audit_log").insert({ actor_user_id: actorUserId, action: "contract_cancel_scheduled", target_type: "store_contract", target_id: contractId, detail: { endsAt: c.current_period_end } });

  if (!c.current_period_end || Date.parse(c.current_period_end as string) <= Date.now()) {
    await finalizeContractCancel(contractId, actorUserId);
    return "契約期間が終わっているため、すぐに解約して店舗ページを削除しました。";
  }
  const endLabel = jpDateLabel(jstDateOf(new Date(Date.parse(c.current_period_end as string) - 1)));
  await notifyStoreLine({ storeId: c.store_id as string }, `ご契約の解約を受け付けました。${endLabel}まではこれまでどおりご利用いただけます。それ以降の請求はありません。契約期間の終了とともに店舗ページは削除されます。`);
  return `解約を受け付けました。${endLabel}の契約期間の終わりで店舗ページを削除します（それまでの請求はありません）。`;
}

export async function undoContractCancel(contractId: string, actorUserId: string | null): Promise<string> {
  const svc = createServiceRoleClient();
  const { data: c } = await svc.from("store_contracts").select("id, status, cancel_at_period_end").eq("id", contractId).maybeSingle();
  if (!c) throw new Error("契約が見つかりません。");
  if (c.status !== "active") throw new Error("すでに契約期間が終わり、店舗ページを削除済みです。新しくお申し込みいただく必要があります。");
  await svc.from("store_contracts").update({ cancel_at_period_end: false, cancel_requested_at: null, updated_at: new Date().toISOString() }).eq("id", contractId);
  await svc.from("audit_log").insert({ actor_user_id: actorUserId, action: "contract_cancel_undone", target_type: "store_contract", target_id: contractId, detail: {} });
  return "解約の予定を取り消しました。次の期間からも今までどおり更新されます。";
}

/** 契約期間の終わりに、契約を終了して店舗ページ・ログインを削除する(何度呼んでも同じ結果) */
export async function finalizeContractCancel(contractId: string, actorUserId: string | null): Promise<void> {
  const svc = createServiceRoleClient();
  const { data: c } = await svc.from("store_contracts").select("id, store_id, status").eq("id", contractId).maybeSingle();
  if (!c) throw new Error("契約が見つかりません。");
  const nowIso = new Date().toISOString();
  const storeId = c.store_id as string;

  if (c.status !== "canceled") {
    await svc.from("store_contracts").update({ status: "canceled", canceled_at: nowIso, updated_at: nowIso }).eq("id", contractId);
    await svc.from("billing_events").insert({ store_contract_id: contractId, event_type: "canceled", source: "manual", note: "解約(契約期間の終わりで終了)" });
  }
  // 残っている未入金の請求書(次の期間以降)は取り消す
  await svc.from("invoices").update({ status: "canceled" }).eq("store_contract_id", contractId).eq("status", "unpaid").is("paid_at", null).gte("period_start", jstDateOf(nowIso));

  const { data: store } = await svc.from("stores").select("id, owner_user_id, status").eq("id", storeId).maybeSingle();
  if (store) {
    // 店舗管理のログインを削除(ログインできなくする)
    if (store.owner_user_id) {
      await svc.from("stores").update({ owner_user_id: null }).eq("id", storeId);
      const { error: delError } = await svc.auth.admin.deleteUser(store.owner_user_id as string);
      if (delError) {
        await svc.from("audit_log").insert({ action: "store_login_delete_failed", target_type: "store", target_id: storeId, detail: { error: delError.message } });
      }
    }
    // 公開ページ・総合管理の店舗一覧から外し、LINE連携も解除
    await svc.from("stores").update({ status: "closed", line_user_id: null }).eq("id", storeId);
    await svc.from("coupons").update({ active: false }).eq("store_id", storeId);
    await svc.from("events").update({ status: "closed" }).eq("store_id", storeId).neq("status", "closed");
    await svc.from("jobs").update({ status: "closed" }).eq("store_id", storeId).neq("status", "closed");
    await svc.from("store_notices").update({ status: "hidden" }).eq("store_id", storeId);
    await svc.from("spot_jobs").update({ published: false }).eq("store_id", storeId);
  }
  await svc.from("audit_log").insert({ actor_user_id: actorUserId, action: "contract_cancel_finalized", target_type: "store_contract", target_id: contractId, detail: { storeId } });
  revalidatePublicData();
}

/** 自動処理から: 解約予定で契約期間が終わった契約を終了する */
export async function finalizeDueCancellations(): Promise<Array<{ id: string; ok: boolean; detail?: string }>> {
  const svc = createServiceRoleClient();
  const { data } = await svc.from("store_contracts").select("id").eq("status", "active").eq("cancel_at_period_end", true).lte("current_period_end", new Date().toISOString());
  const out: Array<{ id: string; ok: boolean; detail?: string }> = [];
  for (const r of (data ?? []) as { id: string }[]) {
    try {
      await finalizeContractCancel(r.id, null);
      out.push({ id: r.id, ok: true });
    } catch (e) {
      out.push({ id: r.id, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
