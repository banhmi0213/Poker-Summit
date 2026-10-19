import "server-only";
import { createHash } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createPaymentOnce, lookupOrder, paymentSessionOutcome, type RawCharge, type SessionOutcome } from "@/lib/komoju";
import { alertAdmin } from "@/lib/admin-alert";

// ============================================================================
// カード決済の台帳(2026/10/18)。カード決済はすべて chargeOnce() を通す。
//
// 二重請求を防ぐ仕組み:
// 1. groupKey = 「何の支払いか」(例: 契約Xの 11/22 からの更新分)。呼び出し側が決まった値で作る。
// 2. 同じ groupKey で「処理中・結果不明・成功」の記録は、データベースの制約で同時に1件しか作れない。
//    → 自動処理が2回動いても、ボタンが2回押されても、2回目は決済まで進めない。
// 3. KOMOJU にも同じ番号を冪等キー・注文番号として送る(同じ番号の再送は KOMOJU 側でも1回扱い)。
// 4. 通信切れ・時間切れなど「決済されたか分からない」ときは失敗扱いにしない。KOMOJU に注文番号で
//    問い合わせて確かめ、それでも分からなければ「結果不明」にして自動の再決済を止め、運営にメールする。
//    (総合管理 > 入金管理 > 決済の監視 から確認できる)
// 5. 失敗が確実なときだけ、次の試行(新しい番号)を作れる(翌日の再決済など)。
// ============================================================================

export type ChargePurpose = "apply" | "renewal" | "change" | "upgrade" | "addon_renewal" | "addon_purchase";

export type ChargeOutcome =
  | { status: "CAPTURED"; attemptId: string; paymentId: string | null; amount: number; replayed: boolean }
  | { status: "FAILED"; attemptId: string; error: string }
  | { status: "UNKNOWN"; attemptId: string; error: string }
  /** 同じ支払いが処理中、または結果不明で確認待ち。決済していない */
  | { status: "BUSY"; attemptId: string | null; error: string };

type Refs = {
  storeContractId?: string | null;
  storeContractAddonId?: string | null;
  listingApplicationId?: string | null;
  storeId?: string | null;
};

const STALE_PENDING_MS = 10 * 60 * 1000;
const PURPOSE_CODE: Record<ChargePurpose, string> = {
  apply: "ap",
  renewal: "rn",
  change: "ch",
  upgrade: "up",
  addon_renewal: "ar",
  addon_purchase: "ab",
};

function idemKeyFor(purpose: ChargePurpose, groupKey: string, attemptNo: number) {
  const h = createHash("sha256").update(groupKey).digest("hex").slice(0, 32);
  return `ps-${PURPOSE_CODE[purpose]}-${h}-${attemptNo}`; // 最大 3+3+32+数桁 < 100文字(KOMOJUの上限)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 結果が分からなかった決済を、KOMOJUに問い合わせて確かめる(必要なら同じ番号で1回だけ再送) */
async function settleUnknown(params: { idemKey: string; customerId: string; amount: number; metadata: Record<string, string>; paymentId?: string | null }): Promise<RawCharge> {
  await sleep(2500);
  const looked = await lookupOrder(params.idemKey, params.paymentId ?? null);
  if (looked.kind === "captured" || looked.kind === "unknown") return looked;
  if (looked.payment) return looked; // 失敗した決済の記録がある = 決済されていない
  if (params.paymentId) return { kind: "unknown", error: "KOMOJUの決済IDはあるが確認できませんでした" };
  // KOMOJU に記録が無い = 最初のリクエストは届いていない可能性が高い。
  // 同じ冪等キーで再送すれば、もし届いていても KOMOJU が同じ結果を返すだけで二重にはならない(24時間以内)。
  return createPaymentOnce({ idemKey: params.idemKey, customerId: params.customerId, amount: params.amount, metadata: params.metadata });
}

export async function chargeOnce(params: {
  purpose: ChargePurpose;
  groupKey: string;
  customerId: string;
  amount: number;
  refs: Refs;
  /** 結果不明を運営が解決したあと、処理の続きを行うための情報 */
  context?: Record<string, unknown>;
  description: string;
}): Promise<ChargeOutcome> {
  const svc = createServiceRoleClient();
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    return { status: "FAILED", attemptId: "", error: `金額が正しくありません(${params.amount}円)。決済していません。` };
  }

  const live = async () => {
    const { data } = await svc
      .from("payment_attempts")
      .select("id, status, amount, komoju_payment_id, created_at, idem_key")
      .eq("group_key", params.groupKey)
      .in("status", ["pending", "captured", "unknown"])
      .maybeSingle();
    return data as { id: string; status: string; amount: number; komoju_payment_id: string | null; created_at: string; idem_key: string } | null;
  };

  const fromLive = async (row: NonNullable<Awaited<ReturnType<typeof live>>>): Promise<ChargeOutcome> => {
    if (row.status === "captured") {
      return { status: "CAPTURED", attemptId: row.id, paymentId: row.komoju_payment_id, amount: row.amount, replayed: true };
    }
    if (row.status === "pending" && Date.now() - Date.parse(row.created_at) > STALE_PENDING_MS) {
      // 途中で止まったまま(サーバーの時間切れ等)。結果不明として扱い、運営に確認してもらう
      await svc.from("payment_attempts").update({ status: "unknown", error: "処理の途中で止まりました", updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "pending");
      await alertAdmin("カード決済の結果が確認できていません", [
        `${params.description}`,
        `金額: ${row.amount.toLocaleString("ja-JP")}円`,
        `注文番号: ${row.idem_key}`,
        "処理の途中で止まったため、自動での再決済を止めています。KOMOJUの管理画面または総合管理から確認してください。",
      ]);
    }
    return { status: "BUSY", attemptId: row.id, error: "同じお支払いを処理中、または結果を確認中です。" };
  };

  const existing = await live();
  if (existing) return fromLive(existing);

  const { data: last } = await svc
    .from("payment_attempts")
    .select("attempt_no")
    .eq("group_key", params.groupKey)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const attemptNo = ((last?.attempt_no as number | undefined) ?? 0) + 1;
  const idemKey = idemKeyFor(params.purpose, params.groupKey, attemptNo);

  const { data: inserted, error: insertError } = await svc
    .from("payment_attempts")
    .insert({
      group_key: params.groupKey,
      attempt_no: attemptNo,
      idem_key: idemKey,
      purpose: params.purpose,
      status: "pending",
      amount: params.amount,
      customer_id: params.customerId,
      store_contract_id: params.refs.storeContractId ?? null,
      store_contract_addon_id: params.refs.storeContractAddonId ?? null,
      listing_application_id: params.refs.listingApplicationId ?? null,
      store_id: params.refs.storeId ?? null,
      context: { ...(params.context ?? {}), description: params.description },
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    // 同時に別の処理が同じ支払いを始めた(制約で弾かれた)
    const other = await live();
    if (other) return fromLive(other);
    return { status: "BUSY", attemptId: null, error: `決済の準備ができませんでした: ${insertError?.message ?? "不明"}` };
  }
  const attemptId = inserted.id as string;

  const metadata: Record<string, string> = { attempt_id: attemptId, purpose: params.purpose };
  if (params.refs.storeContractId) metadata.store_contract_id = params.refs.storeContractId;
  if (params.refs.storeContractAddonId) metadata.store_contract_addon_id = params.refs.storeContractAddonId;
  if (params.refs.listingApplicationId) metadata.listing_application_id = params.refs.listingApplicationId;

  let result = await createPaymentOnce({ idemKey, customerId: params.customerId, amount: params.amount, metadata });
  if (result.kind === "unknown") {
    result = await settleUnknown({ idemKey, customerId: params.customerId, amount: params.amount, metadata, paymentId: result.payment?.id ?? null });
  }

  const nowIso = new Date().toISOString();
  if (result.kind === "captured") {
    // 金額の確認: KOMOJUが返した金額が依頼した金額と違うときは運営に知らせる(処理は成功として進める)
    if (result.payment.amount != null && Number(result.payment.amount) !== params.amount) {
      await alertAdmin("カード決済の金額が依頼と違います", [params.description, `依頼: ${params.amount}円 / KOMOJU: ${result.payment.amount}円`, `注文番号: ${idemKey}`]);
    }
    await svc.from("payment_attempts").update({ status: "captured", komoju_payment_id: result.payment.id ?? null, error: null, updated_at: nowIso }).eq("id", attemptId);
    return { status: "CAPTURED", attemptId, paymentId: result.payment.id ?? null, amount: params.amount, replayed: false };
  }
  if (result.kind === "failed") {
    await svc.from("payment_attempts").update({ status: "failed", komoju_payment_id: result.payment?.id ?? null, error: result.error.slice(0, 1000), updated_at: nowIso }).eq("id", attemptId);
    return { status: "FAILED", attemptId, error: result.error };
  }
  await svc.from("payment_attempts").update({ status: "unknown", komoju_payment_id: result.payment?.id ?? null, error: result.error.slice(0, 1000), updated_at: nowIso }).eq("id", attemptId);
  console.error("[payment] unknown outcome", idemKey, result.error);
  await alertAdmin("カード決済の結果が確認できていません", [
    params.description,
    `金額: ${params.amount.toLocaleString("ja-JP")}円`,
    `注文番号: ${idemKey}`,
    `内容: ${result.error}`,
    "二重請求を防ぐため、この支払いの自動での再決済を止めています。",
    "総合管理の「決済の監視」で「KOMOJUで確認する」を押すと、結果を確かめて続きの処理を行います。",
  ]);
  return { status: "UNKNOWN", attemptId, error: result.error };
}

/**
 * 結果不明(または途中で止まった)の決済を、KOMOJUに注文番号で問い合わせて確定させる。
 * 決済されていれば captured、されていなければ failed にする(新たに決済はしない)。
 */
export async function reconcileAttempt(attemptId: string, adminUserId: string | null): Promise<{ status: "captured" | "failed" | "unknown"; detail: string }> {
  const svc = createServiceRoleClient();
  const { data: row } = await svc.from("payment_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (!row) throw new Error("決済の記録が見つかりません。");
  if (row.status === "captured" || row.status === "failed") return { status: row.status, detail: "確定済みです。" };
  // KOMOJUの画面でお客様が支払う決済(初回の申込み)は、支払いセッションの状態で確かめる
  const sessionId = (row.context as any)?.sessionId as string | undefined;
  if (sessionId) {
    const out = await settleHostedAttempt(attemptId, await paymentSessionOutcome(sessionId).catch((e) => ({ kind: "unknown", error: `KOMOJUに確認できませんでした: ${e instanceof Error ? e.message : String(e)}`, customerId: null }) as SessionOutcome), adminUserId);
    if (out.status === "open") {
      // 24時間たっても支払われていないセッションは、もう使われないものとして終える(決済はされていない)
      if (Date.now() - Date.parse(row.created_at as string) > 24 * 3600 * 1000) {
        await svc.from("payment_attempts").update({ status: "failed", error: "お客様が支払いを完了しないまま24時間が過ぎました", updated_at: new Date().toISOString() }).eq("id", attemptId).eq("status", "pending");
        return { status: "failed", detail: "お客様が支払いを完了していません（24時間経過）。" };
      }
      return { status: "unknown", detail: "お客様がまだKOMOJUの画面で支払っていません。" };
    }
    return { status: out.status as "captured" | "failed" | "unknown", detail: out.detail };
  }
  const looked = await lookupOrder(row.idem_key as string, (row.komoju_payment_id as string | null) ?? null);
  const nowIso = new Date().toISOString();
  if (looked.kind === "captured") {
    await svc.from("payment_attempts").update({ status: "captured", komoju_payment_id: looked.payment.id ?? null, resolved_by: adminUserId, resolved_note: "KOMOJUで決済済みを確認", updated_at: nowIso }).eq("id", attemptId);
    return { status: "captured", detail: "KOMOJUで決済済みでした。" };
  }
  if (looked.kind === "failed") {
    await svc.from("payment_attempts").update({ status: "failed", error: looked.error, resolved_by: adminUserId, resolved_note: "KOMOJUで未決済を確認", updated_at: nowIso }).eq("id", attemptId);
    return { status: "failed", detail: "KOMOJUでは決済されていませんでした。" };
  }
  return { status: "unknown", detail: looked.error };
}

/** 自動処理から: 10分以上たっても確定していない決済を、KOMOJUに問い合わせて確定させる */
export async function reconcileStaleAttempts(): Promise<Array<{ id: string; status: string; detail: string }>> {
  const svc = createServiceRoleClient();
  const before = new Date(Date.now() - STALE_PENDING_MS).toISOString();
  const { data } = await svc.from("payment_attempts").select("id").in("status", ["pending", "unknown"]).lt("created_at", before).limit(50);
  const out: Array<{ id: string; status: string; detail: string }> = [];
  for (const r of (data ?? []) as { id: string }[]) {
    const res = await reconcileAttempt(r.id, null).catch((e) => ({ status: "unknown" as const, detail: e instanceof Error ? e.message : String(e) }));
    out.push({ id: r.id, ...res });
  }
  return out;
}

/** 契約の期間ごとの支払いの groupKey(期間の終わりは日本時間の日付で表す) */
export function periodGroupKey(prefix: string, id: string, periodEndIso: string | null | undefined, extra?: string): string {
  const day = periodEndIso ? new Date(Date.parse(periodEndIso) + 9 * 3600 * 1000).toISOString().slice(0, 10) : "none";
  return [prefix, id, day, extra].filter(Boolean).join(":");
}


// ============================================================================
// KOMOJUの画面でお客様が支払う決済(初回の申込み・2026/10/19)
// サーバーから決済する chargeOnce() と同じ台帳(payment_attempts)を使う。
//   1. beginHostedAttempt: 支払いの記録を「処理中」で作る(同じ支払いは同時に1件だけ)
//   2. お客様をKOMOJUの支払い画面へ(注文番号 = idemKey)
//   3. settleHostedAttempt: 戻ってきたとき・自動処理で、セッションの結果を記録する
// 戻らずに画面を閉じた人も、自動処理(/api/cron/payment-sessions)がセッションを確かめて続きを行う。
// ============================================================================

export type HostedBegin =
  | { status: "NEW"; attemptId: string; idemKey: string }
  | { status: "CAPTURED"; attemptId: string }
  | { status: "BUSY"; attemptId: string | null; sessionId: string | null; error: string };

export async function beginHostedAttempt(params: {
  purpose: ChargePurpose;
  groupKey: string;
  amount: number;
  refs: Refs;
  context?: Record<string, unknown>;
  description: string;
}): Promise<HostedBegin> {
  const svc = createServiceRoleClient();
  const { data: existing } = await svc
    .from("payment_attempts")
    .select("id, status, context")
    .eq("group_key", params.groupKey)
    .in("status", ["pending", "captured", "unknown"])
    .maybeSingle();
  if (existing) {
    if (existing.status === "captured") return { status: "CAPTURED", attemptId: existing.id as string };
    return { status: "BUSY", attemptId: existing.id as string, sessionId: ((existing.context as any)?.sessionId as string) ?? null, error: "同じお支払いを処理中です。" };
  }
  const { data: last } = await svc.from("payment_attempts").select("attempt_no").eq("group_key", params.groupKey).order("attempt_no", { ascending: false }).limit(1).maybeSingle();
  const attemptNo = ((last?.attempt_no as number | undefined) ?? 0) + 1;
  const idemKey = idemKeyFor(params.purpose, params.groupKey, attemptNo);
  const { data: inserted, error } = await svc
    .from("payment_attempts")
    .insert({
      group_key: params.groupKey,
      attempt_no: attemptNo,
      idem_key: idemKey,
      purpose: params.purpose,
      status: "pending",
      amount: params.amount,
      customer_id: null,
      store_contract_id: params.refs.storeContractId ?? null,
      store_contract_addon_id: params.refs.storeContractAddonId ?? null,
      listing_application_id: params.refs.listingApplicationId ?? null,
      store_id: params.refs.storeId ?? null,
      context: { ...(params.context ?? {}), description: params.description, hosted: true },
    })
    .select("id")
    .single();
  if (error || !inserted) return { status: "BUSY", attemptId: null, sessionId: null, error: `決済の準備ができませんでした: ${error?.message ?? "不明"}` };
  return { status: "NEW", attemptId: inserted.id as string, idemKey };
}

/** 支払いセッションのIDを記録に残す(戻ってこなかったときに自動処理が確かめるため) */
export async function attachHostedSession(attemptId: string, sessionId: string): Promise<void> {
  const svc = createServiceRoleClient();
  const { data: row } = await svc.from("payment_attempts").select("context").eq("id", attemptId).maybeSingle();
  await svc.from("payment_attempts").update({ context: { ...((row?.context as object) ?? {}), sessionId }, updated_at: new Date().toISOString() }).eq("id", attemptId);
}

/** セッションの作成に失敗したとき(KOMOJUの画面に進んでいない = 決済されていない) */
export async function abandonHostedAttempt(attemptId: string, error: string): Promise<void> {
  const svc = createServiceRoleClient();
  await svc.from("payment_attempts").update({ status: "failed", error: error.slice(0, 1000), updated_at: new Date().toISOString() }).eq("id", attemptId).eq("status", "pending");
}

/**
 * セッションの結果を記録する。
 * - captured: 決済済み(customer_id も残す)。以前「失敗」にしていても、KOMOJUで決済済みなら決済済みに直す
 * - failed: 決済されていない
 * - unknown: 確認待ち(運営にメール)
 * - open: お客様がまだ支払い画面にいる(何もしない)
 */
export async function settleHostedAttempt(attemptId: string, outcome: SessionOutcome, adminUserId: string | null = null): Promise<{ status: "captured" | "failed" | "unknown" | "open"; detail: string; customerId: string | null; paymentId: string | null }> {
  const svc = createServiceRoleClient();
  const nowIso = new Date().toISOString();
  const { data: row } = await svc.from("payment_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (!row) throw new Error("決済の記録が見つかりません。");
  const customerId = outcome.customerId ?? ((row.customer_id as string | null) ?? null);
  if (outcome.kind === "open") return { status: "open", detail: "支払い画面で操作中です。", customerId, paymentId: null };
  if (outcome.kind === "captured") {
    if (row.status !== "captured") {
      if (outcome.payment.amount != null && Number(outcome.payment.amount) !== Number(row.amount)) {
        await alertAdmin("カード決済の金額が依頼と違います", [String((row.context as any)?.description ?? ""), `依頼: ${row.amount}円 / KOMOJU: ${outcome.payment.amount}円`, `注文番号: ${row.idem_key}`]);
      }
      await svc
        .from("payment_attempts")
        .update({ status: "captured", komoju_payment_id: outcome.payment.id ?? null, customer_id: customerId, error: null, updated_at: nowIso, ...(adminUserId ? { resolved_by: adminUserId, resolved_note: "KOMOJUで決済済みを確認" } : {}) })
        .eq("id", attemptId);
    }
    return { status: "captured", detail: "KOMOJUで決済済みです。", customerId, paymentId: outcome.payment.id ?? null };
  }
  if (outcome.kind === "failed") {
    if (row.status === "pending" || row.status === "unknown") {
      await svc.from("payment_attempts").update({ status: "failed", komoju_payment_id: outcome.payment?.id ?? null, error: outcome.error.slice(0, 1000), updated_at: nowIso }).eq("id", attemptId);
    }
    return { status: "failed", detail: "決済されていません。", customerId, paymentId: outcome.payment?.id ?? null };
  }
  if (row.status === "pending") {
    await svc.from("payment_attempts").update({ status: "unknown", komoju_payment_id: outcome.payment?.id ?? null, customer_id: customerId, error: outcome.error.slice(0, 1000), updated_at: nowIso }).eq("id", attemptId);
    await alertAdmin("カード決済の結果が確認できていません", [
      String((row.context as any)?.description ?? ""),
      `金額: ${Number(row.amount).toLocaleString("ja-JP")}円`,
      `注文番号: ${row.idem_key}`,
      `内容: ${outcome.error}`,
      "総合管理の「決済の監視」で「KOMOJUで確認する」を押すと、結果を確かめて続きの処理を行います。",
    ]);
  }
  return { status: "unknown", detail: outcome.error, customerId, paymentId: outcome.payment?.id ?? null };
}
