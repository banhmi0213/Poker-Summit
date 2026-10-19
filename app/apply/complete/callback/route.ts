import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { paymentSessionOutcome, type SessionOutcome } from "@/lib/komoju";
import { settleHostedAttempt } from "@/lib/payment-ledger";
import { alertAdmin } from "@/lib/admin-alert";
import { provisionPaidStoreFromApplication } from "@/lib/store-provision";

// ============================================================================
// KOMOJUの支払い画面(customer_payment モードのセッション)から戻ったときの戻り先(return_url)。
// 2026/10/19〜: 初月分の支払いとカード登録は、お客様がKOMOJUの画面で行う(本人認証もそこで)。
// ここではセッションの結果をKOMOJUに問い合わせて、決済済みなら店舗自動作成〜ログイン発行まで行う。
// 戻らずに画面を閉じた人は、自動処理(/api/cron/payment-sessions)が同じ確認と店舗発行を行う。
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
  if (application.payment_status === "active" || application.payment_status === "charged_pending_manual" || application.payment_status === "charge_unknown") {
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

  // この申込みの支払いの記録(lib/payment-ledger.ts の beginHostedAttempt で作ったもの)
  const { data: attempt } = await supabase
    .from("payment_attempts")
    .select("id, status, context, customer_id")
    .eq("group_key", `apply:${applicationId}`)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sessionId =
    ((attempt?.context as any)?.sessionId as string | undefined) ??
    (application.fincode_customer_id.startsWith("session:") ? application.fincode_customer_id.slice("session:".length) : undefined);
  if (!attempt || !sessionId) {
    await supabase
      .from("listing_applications")
      .update({ payment_status: "failed", payment_note: "支払いの記録が見つかりませんでした。" })
      .eq("id", applicationId);
    return NextResponse.redirect(
      `${siteOrigin}/apply?error=${encodeURIComponent("お支払いの確認ができませんでした。お手数ですがもう一度お試しください。")}`,
      { status: 303 }
    );
  }

  // 二重処理の防止: 同じ申込みの戻り先が同時に2回開かれても、続きの処理は1回だけ
  const { data: claimed } = await supabase
    .from("listing_applications")
    .update({ payment_status: "processing" })
    .eq("id", applicationId)
    .not("payment_status", "in", "(processing,active,charged_pending_manual,charge_unknown)")
    .select("id");
  if (!claimed?.length) {
    return NextResponse.redirect(`${siteOrigin}/apply/complete?application=${applicationId}`, { status: 303 });
  }

  const outcome: SessionOutcome = await paymentSessionOutcome(sessionId).catch(
    (e) => ({ kind: "unknown", error: `KOMOJUに確認できませんでした: ${e instanceof Error ? e.message : String(e)}`, customerId: null }) as SessionOutcome
  );
  const settled = await settleHostedAttempt(attempt.id as string, outcome);
  const charge = { status: settled.status, error: settled.detail, attemptId: attempt.id as string };
  const customerId = settled.customerId;
  if (customerId) {
    await supabase.from("listing_applications").update({ fincode_customer_id: customerId }).eq("id", applicationId);
  }

  if (settled.status === "open" || settled.status === "unknown") {
    // 決済したか分からない(支払い画面の途中で戻ってきた等): 失敗にしない。自動処理・運営が確認して続きを行う
    await supabase
      .from("listing_applications")
      .update({ payment_status: "charge_unknown", payment_note: `決済の結果確認待ち: ${settled.detail}`.slice(0, 500) })
      .eq("id", applicationId);
    return NextResponse.redirect(`${siteOrigin}/apply/complete?application=${applicationId}`, { status: 303 });
  }

  if (settled.status !== "captured") {
    await supabase
      .from("listing_applications")
      .update({
        payment_status: "failed",
        payment_note: `決済失敗: ${charge.error}`.slice(0, 500),
      })
      .eq("id", applicationId);
    return NextResponse.redirect(
      `${siteOrigin}/apply?error=${encodeURIComponent(
        "決済が完了しませんでした。カード情報をご確認のうえもう一度お試しください。"
      )}`,
      { status: 303 }
    );
  }
  if (!customerId) {
    // 決済はできているが、2か月目以降に使うカードの登録が確認できない。店舗は発行し、運営に知らせる
    await alertAdmin("新規申込みのカード登録が確認できませんでした", [
      `申込み: ${application.company_name}（${application.email}）`,
      "初月分は決済済みです。2か月目以降の自動決済に使うカード(customer)がKOMOJUの結果に含まれていませんでした。",
      "KOMOJUの管理画面で確認し、必要なら店舗にカードの再登録（プラン画面）をお願いしてください。",
    ]);
  }
  const orderId = charge.attemptId;

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
    await alertAdmin("決済済みの新規申込みで店舗の発行に失敗しました", [
      `申込み: ${application.company_name}（${application.email}）`,
      `金額: ${plan.monthly_fee.toLocaleString("ja-JP")}円（決済済み）`,
      `内容: ${e instanceof Error ? e.message : String(e)}`,
      "総合管理の「決済の監視」から「店舗を発行する」を押すと、もう一度発行します（二重には作りません）。",
    ]);
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
