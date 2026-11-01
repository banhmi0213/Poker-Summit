import { revalidatePublicData } from "@/lib/revalidate";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateStoreLinkCode } from "@/lib/store-update";
import { sendStoreCredentialsEmail } from "@/lib/email";
import { generateStorePassword } from "@/lib/password-policy";
import { freshPeriodEnd } from "@/lib/billing-dates";

// ============================================================================
// セルフサーブ申込み(listing_applications, plan_id付き)がKOMOJUの初回課金に
// 成功した直後に呼ばれる、店舗の自動作成〜ID/LINE連携コード発行まで
// 一式。app/admin/stores/actions.ts の issueStoreLogin() / issueStoreLineLinkCode()
// と同じ処理を、管理者セッションなし(=is_admin()が通らないservice-role実行)
// でも行えるようにしたもの。RPCはsystem_issue_store_login()を使う
// (admin_issue_store_login()とは別物。マイグレーション参照)。
// ============================================================================



type ListingApplicationRow = {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    tel: string | null;
    pref: string | null;
    category: string | null;
    plan_id: string | null;
};

export async function provisionPaidStoreFromApplication(params: {
    application: ListingApplicationRow;
    // カード(KOMOJU)で申し込んだ場合。列名は旧決済会社時代の fincode_* のまま(中身はKOMOJUの顧客ID)
    fincodeCustomerId?: string | null;
    fincodeSubscriptionId?: string | null;
    // 銀行振込で申し込み、運営が入金を確認した場合(lib/bank-transfer.ts)
    billing?: { method: "bank_transfer"; cycleMonths: number; currentPeriodEndIso: string; anchorDay?: number | null };
}): Promise<{ storeId: string; loginId: string; password: string; lineCode: string }> {
    const supabase = createServiceRoleClient();
    const { application } = params;

// 掲載中の店舗と結び付いた申込み(フォームで「このお店です」を選んだもの)は、新しく作らずに
// その店舗に契約と店舗管理アカウントを付ける(写真・営業時間などをそのまま引き継ぐ、重複防止。2026/10)。
const { data: appExtra } = await supabase
    .from("listing_applications")
    .select("store_name, address, matched_store_id")
    .eq("id", application.id)
    .maybeSingle();
// やり直しに強くする(2026/10/18): 途中で失敗して入金確認・決済後の処理をもう一度行っても、
// 店舗・契約・ログインを二重に作らない。この申込みで作った/結び付けた店舗があればそれを使う。
let storeId: string;
const matchedId = (appExtra?.matched_store_id as string | null) ?? null;
const { data: already } = await supabase.from("stores").select("id").eq("source_application_id", application.id).maybeSingle();
if (already) {
    storeId = already.id as string;
} else if (matchedId) {
    const { data: existing } = await supabase.from("stores").select("id, owner_user_id, status").eq("id", matchedId).maybeSingle();
    if (!existing) throw new Error("結び付け先の店舗が見つかりません。");
    if (existing.owner_user_id) throw new Error("結び付け先の店舗には、すでに店舗管理アカウントが発行されています。");
    storeId = existing.id as string;
    const { error: linkError } = await supabase.from("stores").update({ source_application_id: application.id }).eq("id", storeId);
    if (linkError) throw new Error(linkError.message);
} else {
    const { data: store, error: storeError } = await supabase
        .from("stores")
        .insert({
            name: (appExtra?.store_name as string | null) || application.company_name,
            category: application.category,
            pref: application.pref,
            tel: application.tel,
            address: (appExtra?.address as string | null) || null,
            status: "approved",
            source_application_id: application.id,
        })
        .select("id")
        .single();
    if (storeError || !store) {
        // 同時に別の処理が同じ申込みの店舗を作った(一意制約)→ そちらを使う
        const { data: raced } = await supabase.from("stores").select("id").eq("source_application_id", application.id).maybeSingle();
        if (!raced) throw new Error(storeError?.message ?? "店舗の作成に失敗しました。");
        storeId = raced.id as string;
    } else {
        storeId = store.id as string;
    }
}

// 日本時間の今日から1か月(以前は世界標準時で計算し、1/31 → 3/3 のようにずれていた。lib/billing-dates.ts)
const isTransfer = params.billing?.method === "bank_transfer";
// カードのまとめ払い(6か月・12か月、2026/10/19〜): 申込みで選んだ月数の期間にする
let cardCycleMonths = 1;
if (!isTransfer) {
    const { data: appCycle } = await supabase.from("listing_applications").select("billing_cycle_months").eq("id", application.id).maybeSingle();
    const m = Number(appCycle?.billing_cycle_months ?? 1);
    cardCycleMonths = m === 6 || m === 12 ? m : 1;
}
const fresh = freshPeriodEnd(new Date(), cardCycleMonths);

const contractRow = {
    store_id: storeId,
    plan_id: application.plan_id,
    status: "active",
    contact_name: application.contact_name,
    contact_email: application.email,
    contact_tel: application.tel,
    fincode_customer_id: params.fincodeCustomerId ?? null,
    fincode_subscription_id: params.fincodeSubscriptionId ?? null,
    last_billing_status: "success",
    last_billing_at: new Date().toISOString(),
    current_period_end: isTransfer ? params.billing!.currentPeriodEndIso : fresh.periodEndIso,
    billing_anchor_day: isTransfer ? params.billing!.anchorDay ?? null : fresh.anchorDay,
    billing_method: isTransfer ? "bank_transfer" : "card",
    billing_cycle_months: isTransfer ? params.billing!.cycleMonths : cardCycleMonths,
    // 前に無料期間・解約で終わった契約を上書きするときに、前の情報を残さない(2026/10/20)
    trial_ends_at: null,
    trial_notice_sent_at: null,
    trial_end_notified_at: null,
    canceled_at: null,
    cancel_at_period_end: false,
    cancel_requested_at: null,
};
// 店舗ごとに契約は1つ(store_id は一意)。やり直しのときは前回作った契約を同じ内容で上書きする
const { error: contractError } = await supabase.from("store_contracts").upsert(contractRow, { onConflict: "store_id" });
    if (contractError) {
        throw new Error(contractError.message);
    }

// ログインIDは店舗ごとに必ず別(店舗IDから作る)。万一ほかの店と同じIDになった場合は
// 店舗IDの桁数を増やして作り直す(DB側でも同じIDは発行できず、1ログイン=1店舗の制約あり)。
const password = generateStorePassword();
let loginId = "";
const { data: ownerRow } = await supabase.from("stores").select("owner_user_id").eq("id", storeId).maybeSingle();
if (ownerRow?.owner_user_id) {
    // やり直し: 前回の処理でログインは作成済み。パスワードだけ新しくして、お知らせし直す
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(ownerRow.owner_user_id as string);
    if (authError || !authUser?.user?.email) throw new Error(authError?.message ?? "ログイン情報を確認できませんでした。");
    loginId = authUser.user.email.split("@")[0];
    const { error: pwError } = await supabase.auth.admin.updateUserById(ownerRow.owner_user_id as string, { password });
    if (pwError) throw new Error(pwError.message);
} else {
    let loginError: { message: string } | null = null;
    for (const len of [8, 12, 32]) {
        loginId = `store-${storeId.replace(/-/g, "").slice(0, len)}`;
        const { error } = await supabase.rpc("system_issue_store_login", {
            p_store_id: storeId,
            p_login_id: loginId,
            p_password: password,
        });
        loginError = error;
        if (!error || !error.message.includes("このログインIDは既に使用されています")) break;
    }
    if (loginError) {
        throw new Error(loginError.message);
    }
}

const lineCode = await generateStoreLinkCode(supabase, storeId);

const { error: appUpdateError } = await supabase
    .from("listing_applications")
    .update({
        status: "approved",
        store_id: storeId,
        payment_status: "active",
        issued_login_id: loginId,
        issued_password: password,
        issued_line_code: lineCode,
    })
    .eq("id", application.id);
    if (appUpdateError) {
        throw new Error(appUpdateError.message);
    }

await supabase.from("audit_log").insert({
    actor_user_id: null,
    actor_email: null,
    action: "store_self_serve_provisioned",
    target_type: "store",
    target_id: storeId,
    detail: { applicationId: application.id, loginId },
});

// ログインID/パスワード/LINE連携コードのメール自動送信。
// /apply/complete の「一度だけ画面表示」は事故(閉じ忘れ・リダイレクト
// 失敗等)に弱いので、そのバックアップとしてメールでも必ず送る。
// ただしメール送信の失敗で決済成功・店舗発行自体を失敗扱いにはしない
// (ベストエフォート。RESEND_API_KEY未設定の環境でも例外を投げない)。
try {
    await sendStoreCredentialsEmail({
        to: application.email,
        companyName: application.company_name,
        loginId,
        password,
        lineCode,
    });
    await supabase.from("audit_log").insert({
        actor_user_id: null,
        actor_email: null,
        action: "store_credentials_email_sent",
        target_type: "store",
        target_id: storeId,
        detail: { applicationId: application.id, to: application.email },
    });
} catch (emailError) {
    await supabase.from("audit_log").insert({
        actor_user_id: null,
        actor_email: null,
        action: "store_credentials_email_failed",
        target_type: "store",
        target_id: storeId,
        detail: {
            applicationId: application.id,
            to: application.email,
            error: emailError instanceof Error ? emailError.message : String(emailError),
        },
    });
}

// 新しく掲載になった店をTOP・一覧へすぐ出す(webhook・入金確認どちらから呼ばれても)
    revalidatePublicData();
    return { storeId, loginId, password, lineCode };
}
