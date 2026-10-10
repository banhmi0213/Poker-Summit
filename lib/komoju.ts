import "server-only";

// ============================================================================
// KOMOJU API ラッパー(サーバー専用)。2026/10 に fincode から切り替え。
//
// 認証: HTTP Basic(ユーザー名 = 非公開鍵、パスワードは空)
// ベースURL: https://komoju.com/api/v1 (テスト/本番はキーの種類で切り替わる)
//
// カードの扱い(カード番号はうちのサーバーを一切通らない):
//   1. 「customer モード」のセッション(KOMOJUのホストページ)でカードを登録してもらう
//   2. 完了後、セッションの customer_id を契約に保存する
//      (DB列名は fincode 時代の fincode_customer_id をそのまま使っている)
//   3. 以降の決済は customer_id を指定して POST /payments(加盟店起点の課金)
// 継続課金は KOMOJU のサブスクリプション機能を使わず、うちの cron
// (/api/cron/apply-scheduled-contract-changes)が契約期間の終わりに決済する。
// ============================================================================

const API_BASE = "https://komoju.com/api/v1";

function secretKey(): string {
  const key = process.env.KOMOJU_SECRET_KEY;
  if (!key) throw new Error("KOMOJU_SECRET_KEY が設定されていません。Vercelの環境変数を確認してください。");
  return key;
}

export class KomojuError extends Error {
  status: number;
  code: string | null;
  body: unknown;
  constructor(status: number, body: any) {
    const err = body?.error ?? body;
    const code = typeof err?.code === "string" ? err.code : null;
    const message = typeof err?.message === "string" ? err.message : JSON.stringify(body);
    super(`KOMOJU API error (${status}${code ? ` ${code}` : ""}): ${message}`);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function komojuFetch<T = any>(method: "GET" | "POST" | "DELETE", path: string, body?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${secretKey()}:`).toString("base64")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (idempotencyKey) headers["X-KOMOJU-IDEMPOTENCY"] = idempotencyKey;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new KomojuError(res.status, json);
  return json as T;
}

// ---------------------------------------------------------------------------
// カード登録(customer モードのセッション)
// ---------------------------------------------------------------------------

export type KomojuSession = {
  id: string;
  mode: string;
  status: string; // pending / completed / cancelled
  session_url: string;
  customer_id?: string | null;
  payment?: KomojuPayment | null;
};

/** カード登録用のホストページを作る。session_url へリダイレクトさせる。 */
export async function createCardRegistrationSession(params: {
  returnUrl: string;
  email?: string | null;
  externalCustomerId?: string | null;
}): Promise<KomojuSession> {
  return komojuFetch<KomojuSession>("POST", "/sessions", {
    mode: "customer",
    currency: "JPY",
    return_url: params.returnUrl,
    default_locale: "ja",
    payment_types: ["credit_card"],
    ...(params.email ? { email: params.email } : {}),
    ...(params.externalCustomerId ? { external_customer_id: params.externalCustomerId } : {}),
  });
}

export async function getSession(sessionId: string): Promise<KomojuSession> {
  return komojuFetch<KomojuSession>("GET", `/sessions/${encodeURIComponent(sessionId)}`);
}

/** 登録が完了したセッションから customer_id を取り出す。未完了なら null。 */
export async function customerIdFromSession(sessionId: string): Promise<string | null> {
  const session = await getSession(sessionId);
  if (session.status !== "completed" && session.status !== "complete") return null;
  return session.customer_id ?? null;
}

// ---------------------------------------------------------------------------
// 決済(登録済みカードへの課金)
// ---------------------------------------------------------------------------

export type KomojuPayment = {
  id: string;
  status: string; // pending / authorized / captured / failed / cancelled / expired / refunded
  amount: number;
  currency: string;
  external_order_num?: string | null;
  payment_details?: { type?: string; last_four_digits?: string; brand?: string } | null;
};

/** 互換用の結果形式(呼び出し側は status === "CAPTURED" で成功判定する) */
export type ChargeResult = { id: string | null; status: string; error_code: string | null };

/**
 * 登録済みカード(customer)にその場で課金する。成功なら status "CAPTURED"。
 * 失敗しても例外にせず、status にKOMOJUの状態、error_code に理由を入れて返す。
 */
export async function chargeSavedCard(params: {
  orderId: string;
  customerId: string;
  amount: number;
  metadata?: Record<string, string>;
}): Promise<ChargeResult> {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    return { id: null, status: "INVALID_AMOUNT", error_code: `amount=${params.amount}` };
  }
  try {
    const payment = await komojuFetch<KomojuPayment>(
      "POST",
      "/payments",
      {
        amount: params.amount,
        currency: "JPY",
        customer: params.customerId,
        external_order_num: params.orderId,
        capture: true,
        ...(params.metadata ? { metadata: params.metadata } : {}),
      },
      params.orderId
    );
    const status = String(payment.status ?? "").toLowerCase();
    return {
      id: payment.id ?? null,
      status: status === "captured" ? "CAPTURED" : status.toUpperCase() || "UNKNOWN",
      error_code: status === "captured" ? null : `status=${status}`,
    };
  } catch (e) {
    if (e instanceof KomojuError) return { id: null, status: "ERROR", error_code: `${e.code ?? e.status}: ${e.message}` };
    return { id: null, status: "ERROR", error_code: e instanceof Error ? e.message : String(e) };
  }
}

/** 返金(全額または一部) */
export async function refundPayment(paymentId: string, amount?: number): Promise<KomojuPayment> {
  return komojuFetch<KomojuPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, amount ? { amount } : {});
}

/** 注文番号を毎回ユニークにする(KOMOJUの external_order_num と冪等キーに使う) */
export function newOrderId(prefix: string, seed: string): string {
  return `${prefix}-${seed.replace(/-/g, "").slice(0, 12)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
