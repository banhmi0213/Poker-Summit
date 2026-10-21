import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createApplyCardSession } from "@/lib/apply-card";

// 確認(本人確認・反社チェック)が済んだカード払いのお申し込みの、お支払いページの入口(2026/10/21)。
// 運営が「確認OK」を押すと、申込者にこのURL(申し込みごとのランダムな鍵つき)がメールで届く。
// 開くとKOMOJUのお支払い画面(初回分の支払い+カード登録)へ進む。戻り先は今までどおり /apply/complete/callback。
export const dynamic = "force-dynamic";

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

  const r = await createApplyCardSession(a);
  if ("error" in r) return fail(origin, r.error);
  return NextResponse.redirect(r.url);
}
