// ============================================================================
// fincode byGMO APIラッパー(サーバー専用)
//
// docs.fincode.jp/api を実機ブラウザで確認しながら実装(2026/09/30時点)。
// 確認できたのは以下のエンドポイント/フィールド名のみで、レスポンスの
// 細部(特にエラー系)は未検証。fincodeのテスト環境で実際に1回動かして
// 挙動を見るまでは「たぶん合っている」レベルとして扱ってください。
//
// 認証: Authorization: Bearer <Secret API Key>
// ベースURL: シークレットキーが m_test_ 始まりならテスト環境
//           (https://api.test.fincode.jp)、m_prod_ 始まりなら本番環境
//           (https://api.fincode.jp) を自動選択する。
// ============================================================================

function getSecretKey(): string {
    const key = process.env.FINCODE_SECRET_KEY;
    if (!key) {
          throw new Error(
                  "FINCODE_SECRET_KEY が設定されていません。Vercelの環境変数を確認してください。"
                );
    }
    return key;
}

function getApiBase(): string {
    const key = getSecretKey();
    if (key.startsWith("m_prod_")) return "https://api.fincode.jp";
    // m_test_ が正式だが、キーの形式を誤って本番と判定しないよう
  // 「m_prod_で始まらない限りテスト環境」をデフォルトにしておく
  // (本番運用に切り替える際はキーをm_prod_のものに差し替えるだけでよい)。
  return "https://api.test.fincode.jp";
}

class FincodeError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
          const messages =
                  body && typeof body === "object" && Array.isArray((body as any).errors)
              ? (body as any).errors
                        .map((e: any) => `${e.error_code ?? "?"}: ${e.error_message ?? "?"}`)
                        .join(" / ")
                    : JSON.stringify(body);
          super(`fincode API error (${status}): ${messages}`);
          this.status = status;
          this.body = body;
    }
}

async function fincodeFetch<T = any>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const res = await fetch(`${getApiBase()}${path}`, {
          method,
          headers: {
                  Authorization: `Bearer ${getSecretKey()}`,
                  "Content-Type": "application/json;charset=UTF-8",
          },
          body: body ? JSON.stringify(body) : undefined,
          cache: "no-store",
    });

  const json = await res.json().catch(() => null);
    if (!res.ok) {
          throw new FincodeError(res.status, json);
    }
    return json as T;
}

// ---------------------------------------------------------------------------
// 顧客
// ---------------------------------------------------------------------------

export type FincodeCustomer = {
    id: string;
    name: string | null;
    email: string | null;
};

export async function createFincodeCustomer(params: {
    name: string;
    email: string;
    phoneNo?: string | null;
}): Promise<FincodeCustomer> {
    return fincodeFetch<FincodeCustomer>("POST", "/v1/customers", {
          name: params.name,
          email: params.email,
          phone_cc: params.phoneNo ? "81" : undefined,
          phone_no: params.phoneNo || undefined,
    });
}

// ---------------------------------------------------------------------------
// 決済手段(カード登録・hosted page)
// ---------------------------------------------------------------------------

export type FincodeCardRegistrationSession = {
    id: string; // lk_...
    link_url: string; // カード登録ページのURL(ここにリダイレクトさせる)
    status: string;
};

function formatFincodeDateTime(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}:${ss}`;
}

// カード情報の入力自体はfincodeがホストするページで行う(自前のフォームは
// 不要=カード番号がうちのサーバーを一切通らない)。
//
// 決済手段API(POST /v1/customers/{id}/payment_methods, pay_type=Card)は
// 「カードトークンを直接渡す」実装向けのAPIで、リダイレクト型(fincode
// ホストのカード入力ページに飛ばす)場合は別の専用API「カード登録URL作成」
// (POST /v1/card_sessions)を使う必要がある(2026/09/30、実機で
// EC013103001/EC013020001エラーを確認して判明)。
//
// レスポンスのlink_urlがカード登録ページのURL。入力完了後は
// success_url / cancel_url へ「POSTメソッドで」リダイレクトされる。
export async function createFincodeCardRegistration(params: {
    customerId: string;
    returnUrl: string;
    returnUrlOnFailure: string;
}): Promise<{ redirect_url: string }> {
    // 有効期限は「今から30分後」にしておく(申込みフォーム送信直後に
  // 即リダイレクトする用途なので、長すぎる必要はない)。
  const expire = new Date(Date.now() + 30 * 60 * 1000);
    const session = await fincodeFetch<FincodeCardRegistrationSession>(
          "POST",
          "/v1/card_sessions",
      {
              customer_id: params.customerId,
              success_url: params.returnUrl,
              cancel_url: params.returnUrlOnFailure,
              expire: formatFincodeDateTime(expire),
      }
        );
    return { redirect_url: session.link_url };
}

// カード登録完了後、顧客のデフォルトカード(= 直前に登録したカード)のIDを
// 取得する。決済実行・サブスク登録にはこのcard_id(cs_...)が必要。
export async function getDefaultCardId(customerId: string): Promise<string | null> {
    const res = await fincodeFetch<{ list: Array<{ id: string; default_flag: string }> }>(
          "GET",
          `/v1/customers/${encodeURIComponent(customerId)}/payment_methods?pay_type=Card`
        );
    const list = res.list ?? [];
    const byDefault = list.find((c) => c.default_flag === "1");
    return (byDefault ?? list[list.length - 1])?.id ?? null;
}

// ---------------------------------------------------------------------------
// 決済(初回課金 — カード登録直後に同期的に1回だけ実行する)
// ---------------------------------------------------------------------------

export type FincodeExecutedPayment = {
    id: string;
    status: string; // "CAPTURED" なら成功
    error_code?: string | null;
};

// 「決済 登録」→「決済 実行」を続けて呼び、その場で成功/失敗が分かる
// 同期的な単発課金。サブスクリプションの初回課金はfincode側のバッチ処理
// 任せ(いつ処理されるか呼び出し側からは分からない)なので、
// 「カード登録直後にパスを即発行する」というこの機能の要件上、
// 初月分だけはこの単発課金で同期的に確定させ、2ヶ月目以降をサブスク
// リプションに任せる設計にしている。
export async function chargeFincodeCardOnce(params: {
    orderId: string;
    customerId: string;
    cardId: string;
    amount: number;
}): Promise<FincodeExecutedPayment> {
    const registered = await fincodeFetch<{ access_id: string }>("POST", "/v1/payments", {
          id: params.orderId,
          pay_type: "Card",
          job_code: "CAPTURE",
          amount: String(params.amount),
          tax: "0",
    });

  // 「決済 実行」にはaccess_id(登録時のレスポンスで払い出される取引ID)が
  // 必須。ここを渡し忘れると401/400になる。
  return fincodeFetch<FincodeExecutedPayment>("PUT", `/v1/payments/${encodeURIComponent(params.orderId)}`, {
        pay_type: "Card",
        access_id: registered.access_id,
        customer_id: params.customerId,
        card_id: params.cardId,
  });
}

// ---------------------------------------------------------------------------
// プラン(サブスクリプションのひな形。うちのplansテーブル1行につき
// fincode側にも1つ、初回利用時に遅延作成してplans.fincode_plan_idに
// キャッシュする)
// ---------------------------------------------------------------------------

export type FincodePlan = {
    id: string; // pl_...
};

export async function createFincodePlan(params: {
    name: string;
    monthlyFee: number;
}): Promise<FincodePlan> {
    return fincodeFetch<FincodePlan>("POST", "/v1/plans", {
          plan_name: params.name,
          amount: String(params.monthlyFee),
          tax: "0",
          interval_pattern: "month",
          interval_count: "1",
    });
}

// ---------------------------------------------------------------------------
// サブスクリプション(2ヶ月目以降の継続課金)
// ---------------------------------------------------------------------------

export type FincodeSubscription = {
    id: string; // su_...
    status: string;
};

function addOneMonth(date: Date): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    return d;
}

function formatFincodeDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
}

export async function createFincodeSubscription(params: {
    customerId: string;
    cardId: string;
    fincodePlanId: string;
}): Promise<FincodeSubscription> {
    return fincodeFetch<FincodeSubscription>("POST", "/v1/subscriptions", {
          pay_type: "Card",
          plan_id: params.fincodePlanId,
          customer_id: params.customerId,
          card_id: params.cardId,
          // 初月分はcreateFincodeSubscriptionを呼ぶ前にchargeFincodeCardOnce()で
          // 単発課金済みという前提。二重課金を避けるため、サブスク自体の課金開始日は
          // 1ヶ月後(2ヶ月目)にする。
          start_date: formatFincodeDate(addOneMonth(new Date())),
    });
}
