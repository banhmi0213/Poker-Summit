import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// ============================================================================
// fincode byGMO Webhook 受け口
//
// docs.fincode.jp/api の「Webhook_通知仕様」をブラウザで実機確認して
// 書き直したもの(2026/09/30時点、以前のクエリパラメータ認証版からの修正)。
//
// 署名: fincodeはWebhook配信時にFincode-Signatureヘッダーへ、Webhook設定
// (fincode管理画面またはWebhook設定APIで登録)時に決めた署名文字列を
// そのまま載せてくる(HMAC等ではなく単純な文字列一致)。FINCODE_WEBHOOK_SECRET
// に同じ文字列を設定しておき、ヘッダーと突き合わせる。
//
// レスポンス: 200かつボディが {"receive": "0"} (またはtext/plainで"0")の
// ときだけ「正常に受信できた」とfincode側が判断する。それ以外
// (4xx/5xx/形式違い)は失敗扱いになり、約20分間隔で最大5回リトライされる。
// なので「うちのDBで該当契約が見つからなかった」ようなアプリ側の事情で
// 4xxを返すと、無限リトライの原因になる — 受信自体はできているのだから、
// マッチしてもしなくても200 + {"receive":"0"}を返す。
//
// イベント種別: fincodeの継続課金(サブスクリプション)の実際の請求イベント
// (recurring.card.batch)は「その日の一括処理の成功/失敗件数」という集計
// 情報しか持っておらず、どのサブスクリプションが成功/失敗したかは含まれて
// いない(公式ドキュメントのサンプルペイロードで確認済み)。そのため
// このWebhookだけでは特定の店舗の継続課金結果を正確には追えない —
// 現状はsubscription_id/customer_idが載っているイベント(登録・更新系)
// だけをベストエフォートでstore_contractsに反映し、集計系イベントは
// 受信確認だけ返して何もしない。正確な継続課金トラッキングが必要になった
// 時点で、GET /v1/payments 等での付き合わせ処理を別途足す必要がある。
//
// なお、初回課金〜店舗自動作成〜ログイン/LINE連携コード発行は
// app/apply/complete/callback/route.ts で同期的に完結させているため、
// このWebhookの担当は「その契約が既に存在するstore_contracts」の継続課金
// 記録のみ。
// ============================================================================

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
          result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

function receiveOk() {
    return NextResponse.json({ receive: "0" }, { status: 200 });
}

function parseFincodeEvent(body: any): {
    eventType: "success" | "failed" | "canceled" | null;
    fincodeSubscriptionId: string | null;
    fincodeCustomerId: string | null;
    amount: number | null;
} {
    const event: string | undefined = body?.event;
    const status: string | undefined = body?.status ?? body?.pay_status;
    const subscriptionId: string | undefined = body?.subscription_id ?? body?.id;
    const customerId: string | undefined = body?.customer_id;
    const amountRaw = body?.total_amount ?? body?.amount;

  let eventType: "success" | "failed" | "canceled" | null = null;

  if (event === "subscription.card.delete") {
        eventType = "canceled";
  } else if (event === "subscription.card.regist" || event === "subscription.card.update") {
        const normalizedStatus = String(status ?? "").toUpperCase();
        if (normalizedStatus === "ACTIVE") eventType = "success";
        else if (normalizedStatus) eventType = "failed";
  } else if (event === "payments.card.capture" || event === "payments.card.exec") {
        const normalizedStatus = String(status ?? "").toUpperCase();
        if (["CAPTURED", "AUTHORIZED"].includes(normalizedStatus)) eventType = "success";
        else if (normalizedStatus) eventType = "failed";
  }
    // recurring.card.batch (集計イベント)等、個別のsubscription_id/customer_idを
  // 持たないイベントはここでeventType=nullのまま返す(呼び出し側で
  // 受信確認のみ行い、DB更新はしない)。

  return {
        eventType,
        fincodeSubscriptionId: subscriptionId ?? null,
        fincodeCustomerId: customerId ?? null,
        amount: typeof amountRaw === "number" ? amountRaw : amountRaw ? Number(amountRaw) || null : null,
  };
}

export async function POST(req: NextRequest) {
    const expectedSecret = process.env.FINCODE_WEBHOOK_SECRET;
    const providedSignature = req.headers.get("fincode-signature");

  if (!expectedSecret) {
        // 環境変数が未設定の間はまだ受け付けられる状態ではない。500系だと
      // fincode側がリトライを続けてしまうので、設定待ちであることが分かる
      // よう503にしておく(こちらは「受信すらできていない」ので通常の
      // receiveOk()とは別扱い)。
      return NextResponse.json({ error: "Webhook is not configured yet." }, { status: 503 });
  }
    if (!providedSignature || !timingSafeEqual(providedSignature, expectedSecret)) {
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

  let body: any;
    try {
          body = await req.json();
    } catch {
          return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

  const { eventType, fincodeSubscriptionId, fincodeCustomerId, amount } = parseFincodeEvent(body);

  // 個別のsubscription_id/customer_idを持たない集計イベント、または
  // ステータスを解釈できなかったイベントは、受信確認だけ返して終える。
  if (!eventType || (!fincodeSubscriptionId && !fincodeCustomerId)) {
        return receiveOk();
  }

  const supabase = createServiceRoleClient();

  let contractQuery = supabase.from("store_contracts").select("id").limit(1);
    if (fincodeSubscriptionId) {
          contractQuery = contractQuery.eq("fincode_subscription_id", fincodeSubscriptionId);
    } else {
          contractQuery = contractQuery.eq("fincode_customer_id", fincodeCustomerId as string);
    }

  const { data: contract } = await contractQuery.maybeSingle();

  if (!contract) {
        // 該当契約が見つからない = 自動発行フロー(app/apply/complete/callback)が
      // まだstore_contractsを作る前に届いたイベントの可能性がある
      // (例: subscription.card.regist が先に飛んでくる場合)。アプリ側の
      // タイミングの問題であってfincode側の配信失敗ではないので、ここでも
      // 受信確認だけ返す(4xxにしてリトライさせても解決しない)。
      return receiveOk();
  }

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

  return receiveOk();
}

export async function GET(req: NextRequest) {
    return POST(req);
}
