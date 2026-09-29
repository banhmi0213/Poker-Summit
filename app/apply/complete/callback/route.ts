import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getDefaultCardId, chargeFincodeCardOnce, createFincodeSubscription } from "@/lib/fincode";
import { provisionPaidStoreFromApplication } from "@/lib/store-provision";

// ============================================================================
// fincodeのカード登録(hosted page)完了後の戻り先(return_url)。
// fincode公式ドキュメント曰く「POSTメソッドでリダイレクトがされます」なので
// POSTで受ける(Next.jsのpage.tsxはGETしか受けないため、route.tsで受けて
// 処理後にGETの表示ページへ302する)。
//
// ここで初回月分を単発課金(同期・その場で成功/失敗が分かる)し、成功したら
// 2ヶ月目以降のサブスクリプションを登録、店舗自動作成〜ログイン/LINE連携
// コード発行まで一気に行う。「決済成功のその場でパス発行」という要件上、
// fincodeのWebhook(非同期・タイミング未確定)を待たずにここで完結させる
// 設計にしている。Webhook側は2ヶ月目以降の継続課金の記録用。
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
    .select("id, monthly_fee, fincode_plan_id")
    .eq("id", application.plan_id)
    .maybeSingle();

  if (!plan || !plan.fincode_plan_id) {
    await supabase
      .from("listing_applications")
      .update({ payment_status: "failed", payment_note: "プラン情報が見つかりません(fincode_plan_id未設定)。" })
      .eq("id", applicationId);
    return NextResponse.redirect(
      `${siteOrigin}/apply?error=${encodeURIComponent("プラン情報が見つかりません。運営までお問い合わせください。")}`,
      { status: 303 }
    );
  }

  const cardId = await getDefaultCardId(application.fincode_customer_id).catch(() => null);
  if (!cardId) {
    await supabase
      .from("listing_applications")
      .update({ payment_status: "failed", payment_note: "カード登録が確認できませんでした。" })
      .eq("id", applicationId);
    return NextResponse.redirect(
      `${siteOrigin}/apply?error=${encodeURIComponent(
        "カード登録が確認できませんでした。お手数ですがもう一度お試しください。"
      )}`,
      { status: 303 }
    );
  }

  const orderId = ("o" + applicationId.replace(/-/g, "")).slice(0, 30);

  let charge;
  try {
    charge = await chargeFincodeCardOnce({
      orderId,
      customerId: application.fincode_customer_id,
      cardId,
      amount: plan.monthly_fee,
    });
  } catch (e) {
    await supabase
      .from("listing_applications")
      .update({
        payment_status: "failed",
        payment_note: e instanceof Error ? e.message : "初回課金に失敗しました。",
      })
      .eq("id", applicationId);
    return NextResponse.redirect(
      `${siteOrigin}/apply?error=${encodeURIComponent(
        "決済に失敗しました。カード情報をご確認のうえもう一度お試しください。"
      )}`,
      { status: 303 }
    );
  }

  if (charge.status !== "CAPTURED") {
    await supabase
      .from("listing_applications")
      .update({
        payment_status: "failed",
        payment_note: `決済失敗: status=${charge.status} error_code=${charge.error_code ?? "-"}`,
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
    const subscription = await createFincodeSubscription({
      customerId: application.fincode_customer_id,
      cardId,
      fincodePlanId: plan.fincode_plan_id,
    });

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
      fincodeCustomerId: application.fincode_customer_id,
      fincodeSubscriptionId: subscription.id,
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

// fincodeは仕様上POSTで戻す想定だが、テスト時に直接開けるようGETも許容する。
export async function GET(req: NextRequest) {
  return handle(req);
}
