import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// ============================================================================
// fincode byGMO Webhook 受け口 — 未検証のスキャフォールドです
//
// このセッションでは fincode の公式Webhookドキュメント(docs.fincode.jp)が
// JavaScriptで描画されるSPAで、当セッションにはブラウザツールが無かったため
// 実際のイベント名・ペイロード構造・署名検証方式を確認できませんでした。
// 以下は「よくある決済代行Webhookの形」を仮定した実装であり、実際の
// fincodeからのWebhook配信を1回受けて中身を確認するまでは正しく動く保証が
// ありません。PC作業日にfincodeのテスト環境でWebhookを1回飛ばしてみて、
// 実際のペイロードを見ながらこのファイルの parseFincodeEvent() を直す想定です。
// raw_payload はどんな形で来ても billing_events にそのまま保存されるので、
// このルート自体が届いたWebhookを取りこぼすことはありません。
//
// 署名検証について: fincodeが独自の署名ヘッダー方式を持っているかどうか
// 未確認だったため、代わりに「Webhook URLにトークンをクエリパラメータで
// 付ける」という、どの決済代行でも使える簡易的な方式にしています
// (fincode管理画面のWebhook通知先URLを
//  https://<domain>/api/webhooks/fincode?token=<FINCODE_WEBHOOK_TOKEN の値>
//  として登録する)。fincode公式の署名検証方式が判明したら、そちらに
// 置き換えてください。
// ============================================================================

function parseFincodeEvent(body: any): {
  eventType: "success" | "failed" | "canceled" | null;
  fincodeSubscriptionId: string | null;
  fincodeCustomerId: string | null;
  amount: number | null;
} {
  // 想定される候補フィールド名を広めに拾う(実データが来たら整理する)。
  const status: string | undefined =
    body?.status ?? body?.pay_status ?? body?.event ?? body?.data?.status;
  const subscriptionId: string | undefined =
    body?.subscription_id ?? body?.id ?? body?.data?.subscription_id;
  const customerId: string | undefined = body?.customer_id ?? body?.data?.customer_id;
  const amountRaw = body?.amount ?? body?.total_amount ?? body?.data?.amount;

  const normalizedStatus = String(status ?? "").toUpperCase();
  let eventType: "success" | "failed" | "canceled" | null = null;
  if (["CAPTURED", "AUTHORIZED", "SUCCESS", "PAID"].includes(normalizedStatus)) {
    eventType = "success";
  } else if (["FAILED", "ERROR", "DECLINED", "SUSPENDED"].includes(normalizedStatus)) {
    eventType = "failed";
  } else if (["CANCELED", "CANCELLED", "EXPIRED"].includes(normalizedStatus)) {
    eventType = "canceled";
  }

  return {
    eventType,
    fincodeSubscriptionId: subscriptionId ?? null,
    fincodeCustomerId: customerId ?? null,
    amount: typeof amountRaw === "number" ? amountRaw : amountRaw ? Number(amountRaw) || null : null,
  };
}

export async function POST(req: NextRequest) {
  const expectedToken = process.env.FINCODE_WEBHOOK_TOKEN;
  const providedToken = req.nextUrl.searchParams.get("token");

  if (!expectedToken) {
    // 環境変数が未設定の間は、Webhookをまだ受け付けられる状態ではない
    // (fincode契約・PC作業日の設定待ち)。500を返してfincode側にリトライ
    // させるより、ここで止めていることが分かるよう503にしておく。
    return NextResponse.json({ error: "Webhook is not configured yet." }, { status: 503 });
  }
  if (!providedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventType, fincodeSubscriptionId, fincodeCustomerId, amount } = parseFincodeEvent(body);

  const supabase = createServiceRoleClient();

  let contractQuery = supabase.from("store_contracts").select("id").limit(1);
  if (fincodeSubscriptionId) {
    contractQuery = contractQuery.eq("fincode_subscription_id", fincodeSubscriptionId);
  } else if (fincodeCustomerId) {
    contractQuery = contractQuery.eq("fincode_customer_id", fincodeCustomerId);
  } else {
    // 契約を特定できる手がかりが無い — ペイロードだけ保存して後で人間が
    // 確認できるようにする(このケースが多発するようなら
    // parseFincodeEvent() のフィールド名を実データに合わせて直す)。
    return NextResponse.json({ received: true, matched: false });
  }

  const { data: contract } = await contractQuery.maybeSingle();

  if (!contract) {
    return NextResponse.json({ received: true, matched: false });
  }

  if (eventType) {
    const occurredAt = new Date().toISOString();

    await supabase.from("billing_events").insert({
      store_contract_id: contract.id,
      event_type: eventType,
      amount,
      occurred_at: occurredAt,
      source: "fincode_webhook",
      raw_payload: body,
    });

    if (eventType === "success" || eventType === "failed") {
      await supabase
        .from("store_contracts")
        .update({ last_billing_status: eventType, last_billing_at: occurredAt })
        .eq("id", contract.id);
    } else if (eventType === "canceled") {
      await supabase
        .from("store_contracts")
        .update({ status: "canceled", canceled_at: occurredAt })
        .eq("id", contract.id);
    }

    revalidatePath("/admin/contracts");
    revalidatePath(`/admin/contracts/${contract.id}`);
  } else {
    // ステータスを解釈できなかった場合も、生データだけは残しておく。
    await supabase.from("billing_events").insert({
      store_contract_id: contract.id,
      event_type: "failed",
      source: "fincode_webhook",
      raw_payload: body,
      note: "未知のステータス値のため failed として暫定記録。parseFincodeEvent() の見直しが必要です。",
    });
  }

  return NextResponse.json({ received: true, matched: true });
}
