import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { chargeSavedCard, customerIdFromSession, newOrderId } from "@/lib/komoju";
import { provisionPaidStoreFromApplication } from "@/lib/store-provision";

// ============================================================================
// KOMOJUのカード登録ページ(customerモードのセッション)完了後の戻り先(return_url)。
// セッションの状態をKOMOJUに問い合わせて customer_id(登録済みカード)を取り出し、
// 初月分をその場で決済(同期・成功/失敗がすぐ分かる)、成功したら店舗自動作成〜
// ログイン/LINE連携コード発行まで一気に行う。
// 2か月目以降は cron(/api/cron/apply-scheduled-contract-changes)が契約期間の
// 終わりに同じカードへ決済する(KOMOJUのサブスク機能は使わない)。
// ============================================================================

async function handle(req: NextRequest): Promise<NextResponse> {
  const applicationId = req.nextUrl.searchParams.get("application");
  const siteOrigin = req.nextUrl.origin;

  if (!applicationId) {
    return NextResponse.redirect(
      `${siteOrigin}/apply?error=${encodeURIComponent("申込みIDが見つかりません。")}`,
      { status: 303 }
    );
  }

  const supabase = createServiceRoleClient();
  const { data: application, error: fetchError } = await supabase
    .from("listing_applications")
    .select(
      "id, company_name, contact_name, email, tel, pref, category, plan_id, fincode_customer_id, payment_status"
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (fetchError || !application) {
    return NextResponse.redirect(
      `${siteOrigin}/apply?error=${encodeURIComponent("申込み情報が見つかりません。")}`,
      { status: 303 }
    );
  }

  // すでに処理済み(二重POST・戻るボタンでの再送信など)なら再処理せず
  // そのまま表示ページへ。
  if (application.payment_status === "active" || application.payment_status === "charged_pending_manual") {
    return NextResponse.redirect(`${siteOrigin}/apply/complete?application=${applicationId}`, {
      status: 303,
    });
  }

  if (!application.fincode_customer_id || !application.plan_id) {
    return NextResponse.redirect(
      `${siteOrigin}/apply?error=${encodeURIComponent("申込み情報が不完全です。お手数ですが最初からやり直してください。")}`,
      { status: 303 }
    );
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("id, monthly_fee")
    .eq("id", application.plan_id)
    .maybeSingle();

  if (!plan) {
    await supabase
      .from("listing_applications")
      .update({ payment_status: "failed", payment_note: "プラン情報が見つかりません。" })
      .eq("id", applicationId);
    return NextResponse.redirect(
      `${siteOrigin}/apply?error=${encodeURIComponent("プラン情報が見つかりません。運営までお問い合わせください。")}`,
      { status: 303 }
    );
  }

  // カード登録セッションの結果を確認して、登録されたカード(customer_id)を取り出す
  let customerId: string | null = application.fincode_customer_id.startsWith("session:")
    ? null
    : application.fincode_customer_id;
  if (!customerId) {
    const sessionId = application.fincode_customer_id.slice("session:".length);
    customerId = await customerIdFromSession(sessionId).catch(() => null);
    if (customerId) {
      await supabase.from("listing_applications").update({ fincode_customer_id: customerId }).eq("id", applicationId);
    }
  }
  if (!customerId) {
    await supabase
      .from("listing_applications")
      .update({ payment_status: "failed", payment_note: "カード登録が確認できませんでした。" })
      .eq("id", applicationId);
    return NextResponse.redirect(
      `${siteOrigin}/apply?error=${encodeURIComponent(
        "カード登録が完了していないか、確認できませんでした。お手数ですがもう一度お試しください。"
      )}`,
      { status: 303 }
    );
  }

  // 二重決済の防止: 同じ申込みの戻り先が同時に2回開かれても、決済するのは1回だけ
  const { data: claimed } = await supabase
    .from("listing_applications")
    .update({ payment_status: "processing" })
    .eq("id", applicationId)
    .not("payment_status", "in", "(processing,active,charged_pending_manual)")
    .select("id");
  if (!claimed?.length) {
    return NextResponse.redirect(`${siteOrigin}/apply/complete?application=${applicationId}`, { status: 303 });
  }

  const orderId = newOrderId("apply", applicationId);
  const charge = await chargeSavedCard({
    orderId,
    customerId,
    amount: plan.monthly_fee,
    metadata: { listing_application_id: applicationId },
  });

  if (charge.status !== "CAPTURED") {
    await supabase
      .from("listing_applications")
      .update({
        payment_status: "failed",
        payment_note: `決済失敗: status=${charge.status} ${charge.error_code ?? ""}`.slice(0, 500),
      })
      .eq("id", applicationId);
    return NextResponse.redirect(
      `${siteOrigin}/apply?error=${encodeURIComponent(
        "決済が完了しませんでした。カード情報をご確認のうえもう一度お試しください。"
      )}`,
      { status: 303 }
    );
  }

  // ここから先はお金が実際に取れている状態。以降で失敗しても「失敗した
  // ことにして終わり」にはできない — 運営の手動フォロー行きにする。
  try {
    await provisionPaidStoreFromApplication({
      application: {
        id: application.id,
        company_name: application.company_name,
        contact_name: application.contact_name,
        email: application.email,
        tel: application.tel,
        pref: application.pref,
        category: application.category,
        plan_id: application.plan_id,
      },
      fincodeCustomerId: customerId,
      fincodeSubscriptionId: null,
    });
  } catch (e) {
    await supabase
      .from("listing_applications")
      .update({
        payment_status: "charged_pending_manual",
        payment_note: `初回課金(${orderId})は成功しましたが、その後の処理でエラー: ${
          e instanceof Error ? e.message : String(e)
        }`,
      })
      .eq("id", applicationId);
    return NextResponse.redirect(`${siteOrigin}/apply/complete?application=${applicationId}`, {
      status: 303,
    });
  }

  return NextResponse.redirect(`${siteOrigin}/apply/complete?application=${applicationId}`, {
    status: 303,
  });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// KOMOJUはGETで戻す。念のためPOSTも受ける。
export async function GET(req: NextRequest) {
  return handle(req);
}
