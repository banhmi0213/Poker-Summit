import { NextRequest, NextResponse } from "next/server";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { customerIdFromSession } from "@/lib/komoju";
import { applyContractBillingChange } from "@/lib/contracts-billing";
import { sendCardRegisteredEmail } from "@/lib/email";
import { notifyStoreLine } from "@/lib/store-line";

// KOMOJUのカード登録ページから戻ってきたところ。登録されたカードを契約に保存し、
// 決済が止まっている(契約期間が切れている)契約なら、その場で更新の決済を行う。
const CARD_SESSION_COOKIE = "ps_card_session";

function back(req: NextRequest, kind: "ok" | "error", message: string) {
  const res = NextResponse.redirect(`${req.nextUrl.origin}/store/profile/plan?${kind}=${encodeURIComponent(message)}`, { status: 303 });
  res.cookies.set(CARD_SESSION_COOKIE, "", { path: "/store", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${req.nextUrl.origin}/store/login`, { status: 303 });

  const sessionId = req.cookies.get(CARD_SESSION_COOKIE)?.value;
  if (!sessionId) return back(req, "error", "カード登録の情報が見つかりませんでした。もう一度お試しください。");
  if (req.nextUrl.searchParams.get("action") === "cancel") return back(req, "error", "カードの登録をキャンセルしました。");

  const customerId = await customerIdFromSession(sessionId).catch(() => null);
  if (!customerId) return back(req, "error", "カードの登録が完了していないか、確認できませんでした。もう一度お試しください。");

  const svc = createServiceRoleClient();
  const { data: store } = await svc.from("stores").select("id").eq("owner_user_id", user.id).maybeSingle();
  const { data: contract } = store
    ? await svc
        .from("store_contracts")
        .select("id, plan_id, current_period_end, billing_method, contact_email, stores(name), store_contract_addons(addon_id, billing_method, fincode_subscription_id, pending_removed_at)")
        .eq("store_id", store.id)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };
  if (!contract) return back(req, "error", "有効な契約が見つかりません。運営にお問い合わせください。");

  const { error } = await svc.from("store_contracts").update({ fincode_customer_id: customerId }).eq("id", contract.id);
  if (error) return back(req, "error", "カード情報を保存できませんでした。運営にお問い合わせください。");
  await svc.from("audit_log").insert({
    actor_user_id: user.id,
    action: "store_card_registered",
    target_type: "store_contract",
    target_id: contract.id,
    detail: {},
  });

  if (contract.contact_email) {
    const storeInfo = (Array.isArray((contract as any).stores) ? (contract as any).stores[0] : (contract as any).stores) as { name?: string } | null;
    await sendCardRegisteredEmail({ to: contract.contact_email, storeName: storeInfo?.name ?? "店舗", at: new Date() }).catch(() => undefined);
  }

  await notifyStoreLine(
    { storeId: store!.id },
    "お支払いに使うクレジットカードが登録（変更）されました。心当たりがない場合は、すぐに運営までご連絡ください。"
  );

  // 契約期間が切れている(前回の決済に失敗している)カード契約は、新しいカードで今すぐ更新する
  const overdue = contract.billing_method !== "bank_transfer" && contract.current_period_end && contract.current_period_end <= new Date().toISOString();
  if (overdue && contract.plan_id) {
    const nowIso = new Date().toISOString();
    const addonIds = ((contract.store_contract_addons ?? []) as any[])
      .filter((a) => (a.billing_method ?? "card") === "card" && !a.fincode_subscription_id && !(a.pending_removed_at && a.pending_removed_at <= nowIso))
      .map((a) => a.addon_id as string);
    try {
      const { chargedAmount } = await applyContractBillingChange({
        storeContractId: contract.id,
        newPlanId: contract.plan_id,
        newAddonIds: addonIds,
        resolvesPendingPlan: false,
        source: "card_renewal",
      });
      return back(req, "ok", `カードを登録し、${chargedAmount.toLocaleString("ja-JP")}円の決済が完了しました。`);
    } catch {
      return back(req, "error", "カードは登録しましたが、決済ができませんでした。カード会社にご確認ください。");
    }
  }

  return back(req, "ok", "カードを登録しました。次回以降の決済はこのカードで行います。");
}
