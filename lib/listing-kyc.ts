import "server-only";
import { randomBytes } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createInvoice, getBillingSettings, sendInvoice, type BillingCycle } from "@/lib/bank-transfer";
import { sendCardPaymentLinkEmail } from "@/lib/email";

// ============================================================================
// 有料掲載の申し込み店舗の確認(本人確認・反社会的勢力のチェック、2026/10/21 KOMOJU審査対応)。
//  1. 申し込み時: 事業者の区分・代表者名・許可番号(任意)と、
//     「反社会的勢力に該当しないこと」の表明・確約をもらう(readKyc)。請求書・決済はまだ送らない。
//  2. 運営の確認: 総合管理の申込詳細で、法人番号の照合(国税庁 法人番号公表サイト)・
//     代表者の本人確認(個人事業主)・公開情報(報道等)の確認をして「確認OK」を押す。
//  3. 確認OK のときだけ、銀行振込は請求書を、カードはお支払いページのリンクを送る(releasePaymentAfterReview)。
// ============================================================================

export type KycInput = {
  entityType: "corporation" | "individual";
  representativeName: string;
  corporateNumber: string | null;
  licenseNumber: string | null;
};

export function readKyc(formData: FormData): { ok: true; value: KycInput } | { ok: false; error: string } {
  const entityType = String(formData.get("entityType") ?? "");
  if (entityType !== "corporation" && entityType !== "individual") return { ok: false, error: "事業者の区分（法人・個人事業主）を選んでください。" };
  const representativeName = String(formData.get("representativeName") ?? "").trim().slice(0, 100);
  if (!representativeName) return { ok: false, error: "代表者名を入力してください。" };
  // 法人番号は申込者には聞かない(2026/10/21 オーナー判断、入力の手間を減らすため)。運営が国税庁の法人番号公表サイトで、法人名・所在地から探して照合する
  const licenseNumber = String(formData.get("licenseNumber") ?? "").trim().slice(0, 100) || null;
  if (formData.get("antisocialPledge") !== "on") return { ok: false, error: "反社会的勢力に該当しないことの表明・確約が必要です。" };
  return { ok: true, value: { entityType, representativeName, corporateNumber: null, licenseNumber } };
}

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://pokersummit.jp";
}

/** 確認OKの申し込みに、請求書(振込)またはお支払いページのリンク(カード)を送る。失敗したら理由を返す */
export async function releasePaymentAfterReview(applicationId: string): Promise<string | null> {
  const svc = createServiceRoleClient();
  const { data: a } = await svc
    .from("listing_applications")
    .select("id, company_name, contact_name, email, plan_id, billing_method, billing_cycle_months, payment_status, kyc_status")
    .eq("id", applicationId)
    .maybeSingle();
  if (!a) return "申し込みが見つかりません。";
  if (a.kyc_status !== "ok") return "確認が済んでいません。";
  if (a.payment_status !== "awaiting_review") return "すでにお支払いの案内を送っています。";
  const { data: plan } = await svc.from("plans").select("id, name, monthly_fee").eq("id", a.plan_id).maybeSingle();
  if (!plan) return "プランが見つかりません。";

  if (a.billing_method === "bank_transfer") {
    const settings = await getBillingSettings(svc);
    const invoice = await createInvoice({
      listingApplicationId: a.id,
      billToName: a.company_name,
      billToContact: a.contact_name,
      billToEmail: a.email,
      plan: { id: plan.id, name: plan.name, monthly_fee: plan.monthly_fee },
      months: (a.billing_cycle_months ?? 1) as BillingCycle,
      settings,
    });
    await svc.from("listing_applications").update({ payment_status: "awaiting_transfer" }).eq("id", a.id);
    try {
      await sendInvoice(invoice, settings, "new");
    } catch (e) {
      return `請求書は作りましたが、メールを送れませんでした（入金管理の「メールで再送」から送り直してください）: ${e instanceof Error ? e.message : String(e)}`;
    }
    return null;
  }

  // カード: お支払いページ(/apply/pay)のリンクを送る。リンクの鍵は申し込みごとのランダムな文字列
  const token = randomBytes(24).toString("hex");
  await svc.from("listing_applications").update({ payment_status: "awaiting_card", pay_token: token }).eq("id", a.id);
  try {
    await sendCardPaymentLinkEmail({ to: a.email, companyName: a.company_name, contactName: a.contact_name, link: `${getSiteUrl()}/apply/pay?app=${a.id}&t=${token}` });
  } catch (e) {
    return `お支払いページの案内メールを送れませんでした: ${e instanceof Error ? e.message : String(e)}`;
  }
  return null;
}
