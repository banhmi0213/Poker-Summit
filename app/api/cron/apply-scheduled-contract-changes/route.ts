import {deliverMatchingNotifications} from "@/lib/matching-notification-delivery";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { applyContractBillingChange } from "@/lib/contracts-billing";

// ============================================================================
// Vercel Cronから毎日呼ばれる、「期間終了時に予約されたプラン・アドオンの
// ダウングレード/解除」を実際に適用するジョブ(2026/10新設)。
//
// 店舗が店舗管理画面から金額の下がる変更をリクエストすると、即座には
// 反映されず store_contracts.pending_plan_id / pending_plan_effective_at
// や store_contract_addons.pending_removed_at に「予約」として記録される
// だけになる(lib/contracts-billing.ts の schedulePlanDowngrade /
// scheduleAddonRemovals)。このジョブは、予約の適用日時(effective_at)が
// 過ぎた契約を見つけて、新しい(低い)金額で改めて決済してから実際に
// 切り替える。
//
// 認証: Vercel Cronからのリクエストは Authorization: Bearer $CRON_SECRET
// を自動で付与してくる。それ以外からの呼び出しは拒否する。
// ============================================================================

export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Retry the durable notification outbox without interfering with billing.
  await deliverMatchingNotifications().catch(()=>undefined);
  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  // 対象1: プランのダウングレード予約が適用日時を過ぎている契約。
  const { data: duePlanContracts, error: planError } = await supabase
    .from("store_contracts")
    .select("id")
    .eq("status", "active")
    .not("pending_plan_id", "is", null)
    .lte("pending_plan_effective_at", nowIso);
  if (planError) {
    return NextResponse.json({ error: planError.message }, { status: 500 });
  }

  // 対象2: アドオンの解除予約が適用日時を過ぎているものを持つ契約。
  const { data: dueAddonRows, error: addonError } = await supabase
    .from("store_contract_addons")
    .select("store_contract_id")
    .eq("billing_method", "card")
    .not("pending_removed_at", "is", null)
    .lte("pending_removed_at", nowIso);
  if (addonError) {
    return NextResponse.json({ error: addonError.message }, { status: 500 });
  }

  const contractIds = Array.from(
    new Set([
      ...(duePlanContracts ?? []).map((c) => c.id as string),
      ...(dueAddonRows ?? []).map((a) => a.store_contract_id as string),
    ])
  );

  const results: Array<{ storeContractId: string; ok: boolean; detail?: string; chargedAmount?: number }> = [];

  for (const storeContractId of contractIds) {
    try {
      const { data: contract, error: contractFetchError } = await supabase
        .from("store_contracts")
        .select("id, plan_id, pending_plan_id, pending_plan_effective_at, status, billing_method")
        .eq("id", storeContractId)
        .single();
      if (contractFetchError || !contract) throw new Error(contractFetchError?.message ?? "契約が見つかりません。");
      if (contract.status !== "active") continue;
      // 銀行振込の契約はカード決済しない(次回分の請求書で切り替える。app/api/cron/bank-transfer)
      if (contract.billing_method === "bank_transfer") continue;

      const planIsDue = !!contract.pending_plan_id && !!contract.pending_plan_effective_at && contract.pending_plan_effective_at <= nowIso;
      const finalPlanId = planIsDue ? (contract.pending_plan_id as string) : (contract.plan_id as string);

      const { data: addonRows, error: addonFetchError } = await supabase
        .from("store_contract_addons")
        .select("addon_id, pending_removed_at")
        .eq("store_contract_id", storeContractId)
        .eq("billing_method", "card");
      if (addonFetchError) throw new Error(addonFetchError.message);

      const finalAddonIds = (addonRows ?? [])
        .filter((a) => !(a.pending_removed_at && a.pending_removed_at <= nowIso))
        .map((a) => a.addon_id as string);

      if (!finalPlanId) {
        results.push({ storeContractId, ok: false, detail: "プランが設定されていません。" });
        continue;
      }

      const { chargedAmount } = await applyContractBillingChange({
        storeContractId,
        newPlanId: finalPlanId,
        newAddonIds: finalAddonIds,
        resolvesPendingPlan: planIsDue,
      });

      results.push({ storeContractId, ok: true, chargedAmount });
    } catch (e) {
      results.push({ storeContractId, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
