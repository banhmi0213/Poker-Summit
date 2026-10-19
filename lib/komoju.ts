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

/**
 * いま使っているKOMOJUのキーが本番(Live)かテストかを、キーの先頭(sk_live_ / sk_test_)で判定する(2026/10/19)。
 * キーそのものは画面に出さない。Vercelの環境変数を変えても、デプロイし直すまで古いキーのまま動く点に注意。
 */
export function komojuKeyMode(): "live" | "test" | "missing" | "unknown" {
  const key = process.env.KOMOJU_SECRET_KEY ?? "";
  if (!key) return "missing";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  return "unknown";
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

/**
 * 決済1回の結果。
 * - captured: 決済できた
 * - failed: 決済されていないことが確実(カードが通らなかった・KOMOJUが受け付けなかった)
 * - unknown: 決済されたかどうか分からない(通信が切れた・時間切れ・KOMOJU側の障害・処理中)
 *   → 失敗扱いにして再決済すると二重請求になりうるので、必ず確かめてから次に進む(lib/payment-ledger.ts)
 */
export type RawCharge =
  | { kind: "captured"; payment: KomojuPayment }
  | { kind: "failed"; error: string; payment?: KomojuPayment | null }
  | { kind: "unknown"; error: string; payment?: KomojuPayment | null };

function classifyPayment(payment: KomojuPayment): RawCharge {
  const status = String(payment.status ?? "").toLowerCase();
  if (status === "captured") return { kind: "captured", payment };
  if (status === "failed" || status === "cancelled" || status === "canceled" || status === "expired") {
    return { kind: "failed", error: `status=${status}`, payment };
  }
  // pending / authorized / refunded など、決済完了とも失敗とも言えない状態
  return { kind: "unknown", error: describePayment(payment), payment };
}

/**
 * 登録済みカード(customer)への課金を1回だけ送る。直接呼ばず、lib/payment-ledger.ts の chargeOnce() を使うこと。
 * idemKey は KOMOJU の冪等キー(X-KOMOJU-IDEMPOTENCY)と注文番号(external_order_num)の両方に使う。
 * 同じ idemKey で再送しても、KOMOJU は24時間以内なら同じ結果を返し、二重に決済しない。
 */
export async function createPaymentOnce(params: {
  idemKey: string;
  customerId: string;
  amount: number;
  metadata?: Record<string, string>;
}): Promise<RawCharge> {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    return { kind: "failed", error: `金額が正しくありません(amount=${params.amount})` };
  }
  try {
    const payment = await komojuFetch<KomojuPayment>(
      "POST",
      "/payments",
      {
        amount: params.amount,
        currency: "JPY",
        customer: params.customerId,
        external_order_num: params.idemKey,
        capture: true,
        ...(params.metadata ? { metadata: params.metadata } : {}),
      },
      params.idemKey
    );
    return classifyPayment(payment);
  } catch (e) {
    if (e instanceof KomojuError) {
      // 409 = 同じ冪等キーの最初のリクエストがまだ処理中。5xx = KOMOJU側の障害。どちらも結果不明。
      if (e.status === 409 || e.status >= 500) return { kind: "unknown", error: e.message };
      // それ以外の4xx(カードが通らない・内容の誤りなど)は決済されていない
      return { kind: "failed", error: e.message };
    }
    // 通信エラー・時間切れ(KOMOJUに届いて決済されている可能性がある)
    return { kind: "unknown", error: e instanceof Error ? e.message : String(e) };
  }
}

/** 注文番号(external_order_num)でKOMOJUの決済を探す。結果不明の決済を確かめるのに使う */
export async function findPaymentsByOrderNum(orderNum: string): Promise<KomojuPayment[]> {
  const json = await komojuFetch<any>("GET", `/payments?external_order_num=${encodeURIComponent(orderNum)}&per_page=50`);
  const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  return (list as KomojuPayment[]).filter((p) => p && p.external_order_num === orderNum);
}

/**
 * 注文番号の決済をKOMOJUで確かめた結果。
 * - captured: 決済済み(1件でも captured があれば)
 * - failed: 決済されていない(見つからない・失敗だけ)
 * - unknown: 処理中などでまだ分からない / KOMOJUに問い合わせできなかった
 */
export async function lookupOrder(orderNum: string, paymentId?: string | null): Promise<RawCharge> {
  try {
    // KOMOJUの決済ID が分かっているときは、それを直接見る(一覧の検索には処理中の決済が出ないことがある)
    if (paymentId) {
      const p = await komojuFetch<any>("GET", `/payments/${encodeURIComponent(paymentId)}`);
      const st = String(p?.status ?? "").toLowerCase();
      const detail = describePayment(p);
      if (st === "captured" || st === "refunded") return { kind: "captured", payment: p };
      if (["failed", "cancelled", "canceled", "expired"].includes(st)) return { kind: "failed", error: detail, payment: p };
      return { kind: "unknown", error: detail, payment: p };
    }
    const payments = await findPaymentsByOrderNum(orderNum);
    const captured = payments.find((p) => String(p.status).toLowerCase() === "captured" || String(p.status).toLowerCase() === "refunded");
    if (captured) return { kind: "captured", payment: captured };
    const undecided = payments.find((p) => !["failed", "cancelled", "canceled", "expired"].includes(String(p.status).toLowerCase()));
    if (undecided) return { kind: "unknown", error: `status=${undecided.status}`, payment: undecided };
    return { kind: "failed", error: payments.length ? `status=${payments.map((p) => p.status).join(",")}` : "KOMOJUに決済がありません" };
  } catch (e) {
    return { kind: "unknown", error: `KOMOJUに確認できませんでした: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** 決済の状態を運営向けに短く書く(処理中の理由を調べるため。カード番号などは含まない) */
function describePayment(p: any): string {
  const d = p?.payment_details ?? {};
  const parts = [
    `status=${p?.status ?? "?"}`,
    d?.type ? `type=${d.type}` : null,
    d?.brand ? `brand=${d.brand}` : null,
    d?.redirect_url ? "本人認証(3Dセキュア)の画面あり" : null,
    p?.payment_deadline ? `期限=${p.payment_deadline}` : null,
    d?.failure_reason || p?.failure_reason ? `理由=${d?.failure_reason ?? p?.failure_reason}` : null,
    p?.refunds?.length ? `返金${p.refunds.length}件` : null,
  ].filter(Boolean);
  return parts.join(" / ");
}

/** 返金(全額または一部) */
export async function refundPayment(paymentId: string, amount?: number): Promise<KomojuPayment> {
  return komojuFetch<KomojuPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, amount ? { amount } : {});
}
