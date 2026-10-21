import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createPaymentSession } from "@/lib/komoju";
import { beginHostedAttempt, attachHostedSession, abandonHostedAttempt } from "@/lib/payment-ledger";
import { discountFor, getBillingSettings, quote, type BillingCycle } from "@/lib/bank-transfer";

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://pokersummit.jp";
}

/**
 * 掲載申し込みのカード払い: KOMOJUのお支払い画面(初回分の支払い+カード登録)を作る(2026/10/21 共通化)。
 * 戻り先は /apply/complete/callback。戻らずに閉じた人は自動処理(/api/cron/payment-sessions)が確かめて店舗を発行する。
 * 成功すればお支払い画面のURL、失敗すれば理由を返す。
 */
export async function createApplyCardSession(a: {
  id: string;
  company_name: string;
  email: string;
  plan_id: string;
  billing_cycle_months: number | null;
}): Promise<{ url: string } | { error: string }> {
  const svc = createServiceRoleClient();
  const { data: plan } = await svc.from("plans").select("id, monthly_fee").eq("id", a.plan_id).maybeSingle();
  if (!plan) return { error: "プランが見つかりません。" };
  const settings = await getBillingSettings(svc);
  const months = (a.billing_cycle_months ?? 1) as BillingCycle;
  const amount = quote(plan.monthly_fee, months, discountFor(settings, months)).total;
  try {
    const begun = await beginHostedAttempt({
      purpose: "apply",
      groupKey: `apply:${a.id}`,
      amount,
      refs: { listingApplicationId: a.id },
      context: { kind: "apply", applicationId: a.id, months },
      description: `新規申込みの${months === 1 ? "初月分" : `${months}か月分（まとめ払い）`}（${a.company_name}）`,
    });
    if (begun.status !== "NEW") {
      return { error: begun.status === "BUSY" && !begun.attemptId ? "決済の準備ができませんでした。時間をおいてもう一度お試しください。" : "このお申し込みのお支払いはすでに手続き中です。" };
    }
    let session;
    try {
      session = await createPaymentSession({
        idemKey: begun.idemKey,
        amount,
        returnUrl: `${siteUrl()}/apply/complete/callback?application=${a.id}`,
        email: a.email,
        externalCustomerId: `app-${a.id}`,
        metadata: { attempt_id: begun.attemptId, purpose: "apply", listing_application_id: a.id },
      });
    } catch (e) {
      await abandonHostedAttempt(begun.attemptId, `決済ページを作れませんでした: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
    if (!session.session_url) {
      await abandonHostedAttempt(begun.attemptId, "決済ページのURLを取得できませんでした。");
      return { error: "決済ページのURLを取得できませんでした。" };
    }
    await attachHostedSession(begun.attemptId, session.id);
    await svc.from("listing_applications").update({ fincode_customer_id: `session:${session.id}`, payment_status: "awaiting_card" }).eq("id", a.id);
    return { url: session.session_url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "決済の準備に失敗しました。" };
  }
}
