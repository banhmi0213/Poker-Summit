import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createPaymentSession } from "@/lib/komoju";
import { beginHostedAttempt, attachHostedSession, abandonHostedAttempt } from "@/lib/payment-ledger";
import { discountFor, getBillingSettings, quote, type BillingCycle } from "@/lib/bank-transfer";

// 確認(本人確認・反社チェック)が済んだカード払いのお申し込みの、お支払いページの入口(2026/10/21)。
// 運営が「確認OK」を押すと、申込者にこのURL(申し込みごとのランダムな鍵つき)がメールで届く。
// 開くとKOMOJUのお支払い画面(初回分の支払い+カード登録)へ進む。戻り先は今までどおり /apply/complete/callback。
export const dynamic = "force-dynamic";

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://pokersummit.jp";
}

function fail(origin: string, message: string) {
  return NextResponse.redirect(new URL(`/apply?error=${encodeURIComponent(message)}`, origin));
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const appId = req.nextUrl.searchParams.get("app") ?? "";
  const token = req.nextUrl.searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(appId) || !/^[0-9a-f]{48}$/.test(token)) return fail(origin, "リンクが正しくありません。");

  const svc = createServiceRoleClient();
  const { data: a } = await svc
    .from("listing_applications")
    .select("id, company_name, email, plan_id, billing_method, billing_cycle_months, payment_status, kyc_status, pay_token")
    .eq("id", appId)
    .maybeSingle();
  if (!a || a.pay_token !== token) return fail(origin, "リンクが正しくありません。");
  if (a.kyc_status !== "ok" || a.billing_method !== "card") return fail(origin, "このお申し込みはお支払いの対象ではありません。お問い合わせフォームからご連絡ください。");
  if (a.payment_status === "active") return NextResponse.redirect(new URL(`/apply/complete?application=${a.id}`, origin));
  if (a.payment_status !== "awaiting_card" && a.payment_status !== "failed") return fail(origin, "このお申し込みのお支払いは手続き中です。しばらくしてからメールをご確認ください。");

  const { data: plan } = await svc.from("plans").select("id, monthly_fee").eq("id", a.plan_id).maybeSingle();
  if (!plan) return fail(origin, "プランが見つかりません。お問い合わせフォームからご連絡ください。");
  const settings = await getBillingSettings(svc);
  const months = (a.billing_cycle_months ?? 1) as BillingCycle;
  const amount = quote(plan.monthly_fee, months, discountFor(settings, months)).total;

  let url: string | null = null;
  let error: string | null = null;
  try {
    const begun = await beginHostedAttempt({
      purpose: "apply",
      groupKey: `apply:${a.id}`,
      amount,
      refs: { listingApplicationId: a.id },
      context: { kind: "apply", applicationId: a.id, months },
      description: `新規申込みの${months === 1 ? "初月分" : `${months}か月分（まとめ払い）`}（${a.company_name}）`,
    });
    if (begun.status !== "NEW") throw new Error(begun.status === "BUSY" && !begun.attemptId ? "決済の準備ができませんでした。時間をおいてもう一度お試しください。" : "このお申し込みのお支払いはすでに手続き中です。");
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
      throw new Error("決済ページのURLを取得できませんでした。");
    }
    await attachHostedSession(begun.attemptId, session.id);
    await svc.from("listing_applications").update({ fincode_customer_id: `session:${session.id}`, payment_status: "awaiting_card" }).eq("id", a.id);
    url = session.session_url;
  } catch (e) {
    error = e instanceof Error ? e.message : "決済の準備に失敗しました。";
  }
  if (!url) return fail(origin, error ?? "決済の準備に失敗しました。");
  return NextResponse.redirect(url);
}
