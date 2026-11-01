"use server";
import { visitSource } from "@/lib/visit-source";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendListingApplicationNotificationEmail, sendListingApplicationReceivedEmail } from "@/lib/email";
import { readKyc } from "@/lib/listing-kyc";
import { createApplyCardSession } from "@/lib/apply-card";
import { pickupSlotsLeft } from "@/lib/plan-entitlements";
import { getBillingSettings, isBillingCycle, type BillingCycle } from "@/lib/bank-transfer";
import { searchStoreCandidates } from "@/lib/store-match";
import { guardPublicForm } from "@/lib/form-guard";

// 申込み名義・店舗名・住所と、掲載中の店舗との結び付け(2026/10)。
// - 店舗名で申し込む: 店舗名だけ必須(請求書の宛名も店舗名)
// - 会社名で申し込む: 会社名と店舗名の両方が必須(請求書の宛名は会社名)
// - matchedStoreId: フォームで「このお店です」と選んだ掲載中の店舗。店名・電話番号・住所のうち
//   2つ以上が一致し、まだ管理者がいない店舗のときだけ受け付ける(サーバー側でも確認し直す)。
async function readApplicant(formData: FormData): Promise<
  | { ok: true; applicantType: "store" | "company"; companyName: string; storeName: string; tel: string; pref: string; address: string; matchedStoreId: string | null }
  | { ok: false; error: string }
> {
  const applicantType = String(formData.get("applicantType") ?? "store") === "company" ? "company" : "store";
  const storeName = String(formData.get("storeName") ?? formData.get("companyName") ?? "").trim();
  const companyInput = String(formData.get("companyName") ?? "").trim();
  const tel = String(formData.get("tel") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const matchedRaw = String(formData.get("matchedStoreId") ?? "").trim();
  if (!storeName) return { ok: false, error: "店舗名を入力してください。" };
  if (applicantType === "company" && !companyInput) return { ok: false, error: "会社名で申し込む場合は、会社名と店舗名の両方を入力してください。" };
  const companyName = applicantType === "company" ? companyInput : storeName;
  let matchedStoreId: string | null = null;
  if (matchedRaw) {
    const candidates = await searchStoreCandidates({ name: storeName, tel, pref, address });
    const hit = candidates.find((c) => c.id === matchedRaw);
    if (!hit || hit.match_count < 2) return { ok: false, error: "選択した掲載中のお店と、入力内容(店舗名・電話番号・住所)が一致しませんでした。入力内容をご確認ください。" };
    if (hit.has_owner) return { ok: false, error: "選択したお店には、すでに店舗管理アカウントが発行されています。お問い合わせフォームからご連絡ください。" };
    matchedStoreId = hit.id;
  }
  return { ok: true, applicantType, companyName, storeName, tel, pref, address, matchedStoreId };
}

// 運営への掲載申込通知メール(2026/10、「問い合わせ、掲載申込があったら
// メール届くように設定しておいて」との指示を受けて追加)。submitApplication()
// とstartPaidApplication()の両方のinsert成功直後から呼ばれる。site_settings
// のnotify_new_listingがONかつnotify_emailが設定されているときだけ送る。
// ベストエフォート: 呼び出し側でtry/catchし、失敗しても申込受付自体は
// 止めないこと(sendInquiryNotificationEmail()と同じ方針)。
async function notifyNewListingApplication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    companyName: string;
    storeName: string;
    matchedStoreId: string | null;
    contactName: string;
    email: string;
    tel: string;
    pref: string;
    category: string;
    message: string;
  }
) {
  try {
    const { data: notifySettings } = await supabase
      .from("site_settings")
      .select("notify_email, notify_new_listing")
      .eq("id", true)
      .maybeSingle();

    if (notifySettings?.notify_new_listing && notifySettings.notify_email) {
      await sendListingApplicationNotificationEmail({
        to: notifySettings.notify_email,
        companyName: params.companyName,
        storeName: params.storeName,
        matchedStoreId: params.matchedStoreId,
        contactName: params.contactName,
        email: params.email,
        tel: params.tel,
        pref: params.pref,
        category: params.category,
        message: params.message,
      });
    }
  } catch {
    // ベストエフォート: 通知失敗で申込受付自体は止めない
  }
}

// 同じ画面からの二重送信の番号(app/request-key-input.tsx)。DBの一意制約で、同じ番号の申込みは1件しか作れない
function readRequestKey(formData: FormData): string | null {
  const v = String(formData.get("requestKey") ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
  return v.length >= 16 ? v : null;
}

/** insert が「同じ番号の申込みがすでにある」(一意制約)で失敗したか */
function isDuplicateRequest(error: { code?: string; message?: string } | null): boolean {
  return !!error && error.code === "23505" && /request_key/.test(`${error.message ?? ""} ${(error as any).details ?? ""}`);
}

export async function submitApplication(formData: FormData) {
  // ロボット対策と回数制限(同じ回線から1時間に5回まで。他人のアドレスへの請求書メールの大量送信を防ぐ)
  {
    const blocked = await guardPublicForm(formData, "apply", 5);
    if (blocked) redirect(`/apply?error=${encodeURIComponent(blocked)}`);
  }
      const supabase = await createClient();

  const { data: settings } = await supabase
        .from("site_settings")
        .select("listing_accept_new")
        .eq("id", true)
        .maybeSingle();

  if (settings && settings.listing_accept_new === false) {
          redirect(
                    `/apply?error=${encodeURIComponent(
                                "現在、新規の掲載申込の受付を停止しております。"
                              )}`
                  );
  }

  const applicant = await readApplicant(formData);
  if (!applicant.ok) redirect(`/apply?error=${encodeURIComponent(applicant.error)}`);
  const { applicantType, companyName, storeName, tel, pref, address, matchedStoreId } = applicant as Extract<Awaited<ReturnType<typeof readApplicant>>, { ok: true }>;
      const contactName = String(formData.get("contactName") ?? "").trim();
      const email = String(formData.get("email") ?? "").normalize("NFKC").trim();
      const emailConfirm = String(formData.get("emailConfirm") ?? "").normalize("NFKC").trim();
      if (email.toLowerCase() !== emailConfirm.toLowerCase()) {
              redirect(`/apply?error=${encodeURIComponent("メールアドレスと確認用のメールアドレスが一致しません。もう一度ご確認ください。")}`);
      }
      const category = String(formData.get("category") ?? "").trim();
      const message = String(formData.get("message") ?? "").trim();

  if (formData.get("agree") !== "on") {
          redirect(`/apply?error=${encodeURIComponent("利用規約・特定商取引法に基づく表記・プライバシーポリシーへの同意が必要です。")}`);
  }
  if (!companyName || !contactName || !email) {
          redirect(
                    `/apply?error=${encodeURIComponent(
                                "店舗名、担当者名、メールアドレスは必須です。"
                              )}`
                  );
  }

  // 二重送信の防止: 同じ内容の申込み(問い合わせ)が10分以内にあれば、新しく作らない
  {
          const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          const { data: dup } = await createServiceRoleClient()
                    .from("listing_applications")
                    .select("id")
                    .ilike("email", email)
                    .eq("company_name", companyName)
                    .is("plan_id", null)
                    .gte("created_at", since)
                    .limit(1);
          if (dup && dup.length > 0) redirect("/apply?done=1");
  }

  const requestKey = readRequestKey(formData);
  const { error } = await supabase.from("listing_applications").insert({
          request_key: requestKey,
          source: visitSource(String(formData.get("source") ?? "").split("/")[0], String(formData.get("source") ?? "").split("/")[1]),
          company_name: companyName,
          applicant_type: applicantType,
          store_name: storeName,
          address: address || null,
          matched_store_id: matchedStoreId,
          contact_name: contactName,
          tel: tel || null,
          email,
          pref: pref || null,
          category: category || null,
          message: message || null,
  });

  if (isDuplicateRequest(error)) redirect("/apply?done=1"); // 二重送信: 最初の1件で受付済み
  if (error) {
          redirect(`/apply?error=${encodeURIComponent(error.message)}`);
  }

  await notifyNewListingApplication(supabase, {
    companyName,
    storeName,
    matchedStoreId,
    contactName,
    email,
    tel,
    pref,
    category,
    message,
  });

  redirect("/apply?done=1");
}

// ---------------------------------------------------------------------------
// プランを選んで申し込むルート(2026/10/21 変更)
//
// 1. listing_applications行を作成(plan_id付き、payment_status='awaiting_review'、事業者の確認の情報つき)
// 2. 申込者に「受付・確認後にご案内」のメール、運営に新規申込みの通知
// 3. 運営が総合管理の申込詳細で確認(本人確認・反社チェック)して「確認OK」を押すと、
//    振込は請求書、カードはお支払いページ(/apply/pay)のリンクを送る(lib/listing-kyc.ts)
// カードのお支払い後は app/apply/complete/callback で店舗を発行する(lib/store-provision.ts)。
// ---------------------------------------------------------------------------


export async function startPaidApplication(formData: FormData) {
  // ロボット対策と回数制限(同じ回線から1時間に5回まで。他人のアドレスへの請求書メールの大量送信を防ぐ)
  {
    const blocked = await guardPublicForm(formData, "apply", 5);
    if (blocked) redirect(`/apply?error=${encodeURIComponent(blocked)}`);
  }
      const supabase = await createClient();

  const { data: settings } = await supabase
        .from("site_settings")
        .select("listing_accept_new")
        .eq("id", true)
        .maybeSingle();

  if (settings && settings.listing_accept_new === false) {
          redirect(
                    `/apply?error=${encodeURIComponent("現在、新規の掲載申込の受付を停止しております。")}`
                  );
  }

  const applicant = await readApplicant(formData);
  if (!applicant.ok) redirect(`/apply?error=${encodeURIComponent(applicant.error)}`);
  const { applicantType, companyName, storeName, tel, pref, address, matchedStoreId } = applicant as Extract<Awaited<ReturnType<typeof readApplicant>>, { ok: true }>;
      const contactName = String(formData.get("contactName") ?? "").trim();
      const email = String(formData.get("email") ?? "").normalize("NFKC").trim();
      const emailConfirm = String(formData.get("emailConfirm") ?? "").normalize("NFKC").trim();
      if (email.toLowerCase() !== emailConfirm.toLowerCase()) {
              redirect(`/apply?error=${encodeURIComponent("メールアドレスと確認用のメールアドレスが一致しません。もう一度ご確認ください。")}`);
      }
      const category = String(formData.get("category") ?? "").trim();
      const message = String(formData.get("message") ?? "").trim();
      const planId = String(formData.get("planId") ?? "").trim();
      const billingMethod = String(formData.get("billingMethod") ?? "card") === "bank_transfer" ? "bank_transfer" : "card";
      const cycleRaw = Number(formData.get("billingCycle") ?? 1);
      const billingCycle: BillingCycle = isBillingCycle(cycleRaw) ? cycleRaw : 1;

  if (formData.get("agree") !== "on") {
          redirect(`/apply?error=${encodeURIComponent("利用規約・特定商取引法に基づく表記・プライバシーポリシーへの同意が必要です。")}`);
  }
  // 事業者の確認(本人確認・反社会的勢力のチェック)の情報(2026/10/21、lib/listing-kyc.ts)
  const kyc = readKyc(formData);
  if (!kyc.ok) redirect(`/apply?error=${encodeURIComponent(kyc.error)}`);
  const kycValue = (kyc as Extract<typeof kyc, { ok: true }>).value;
  if (!companyName || !contactName || !email) {
          redirect(
                    `/apply?error=${encodeURIComponent("店舗名、担当者名、メールアドレスは必須です。")}`
                  );
  }
      if (!planId) {
              redirect(`/apply?error=${encodeURIComponent("プランを選択してください。")}`);
      }

  // plan_idの実在確認は通常のRLSクライアントで(公開読み取り可のactiveプランのみ)。
  const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("id, name, monthly_fee, fincode_plan_id, active, pickup")
        .eq("id", planId)
        .maybeSingle();

  if (planError || !plan || !plan.active) {
          redirect(`/apply?error=${encodeURIComponent("選択されたプランが見つかりません。")}`);
  }

  // プレミアムプラン(PICK UP表示付き)は各都道府県10店舗まで。カード決済に
  // 進む前に空きを確認する(満枠なら申込みを止める。最終判定はDBトリガー)。
  if (plan.pickup) {
          if (!pref) {
                    redirect(`/apply?error=${encodeURIComponent("プレミアムプランをお申込みの場合は都道府県を選択してください。")}`);
          }
          if ((await pickupSlotsLeft(supabase, pref)) <= 0) {
                    redirect(`/apply?error=${encodeURIComponent(`${pref}のプレミアムプラン（PICK UP枠・10店舗限定）は現在満枠のため、お申込みを受け付けておりません。`)}`);
          }
  }

  const billingSettings = await getBillingSettings(createServiceRoleClient());
  if (billingMethod === "card") {
          // カード払いを一般に止めている間も、運営だけは確認用に申し込める
          const { data: isAdmin } = await (await createClient()).rpc("is_admin");
          if (!billingSettings.cardPaymentEnabled && isAdmin !== true) {
                    redirect(`/apply?error=${encodeURIComponent("現在クレジットカードでのお申込みは受け付けておりません。銀行振込をお選びください。")}`);
          }
  }

  // 二重送信の防止: 同じ内容の振込申込みが10分以内にあれば、新しく作らず完了画面へ
  // (ボタンの連打で請求書が何通も届かないように)
  if (billingMethod === "bank_transfer") {
          const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          const { data: dup } = await createServiceRoleClient()
                    .from("listing_applications")
                    .select("id")
                    .ilike("email", email)
                    .eq("company_name", companyName)
                    .eq("plan_id", planId)
                    .eq("billing_cycle_months", billingCycle)
                    .eq("billing_method", "bank_transfer")
                    .gte("created_at", since)
                    .limit(1);
          if (dup && dup.length > 0) redirect("/apply?done=review");
  }

  const requestKey = readRequestKey(formData);
  const { data: application, error: insertError } = await supabase
        .from("listing_applications")
        .insert({
                  request_key: requestKey,
                  source: visitSource(String(formData.get("source") ?? "").split("/")[0], String(formData.get("source") ?? "").split("/")[1]),
                  company_name: companyName,
                  applicant_type: applicantType,
                  store_name: storeName,
                  address: address || null,
                  matched_store_id: matchedStoreId,
                  contact_name: contactName,
                  tel: tel || null,
                  email,
                  pref: pref || null,
                  category: category || null,
                  message: message || null,
                  plan_id: planId,
                  // 振込: 確認(本人確認・反社チェック)が済んでから請求書を送る。
                  // カード: その場で支払い・すぐ使い始められる。確認は支払いの後に運営が行い、NGなら掲載停止・返金(2026/10/21 オーナー判断)
                  payment_status: billingMethod === "bank_transfer" ? "awaiting_review" : "awaiting_card",
                  billing_method: billingMethod,
                  billing_cycle_months: billingCycle,
                  entity_type: kycValue.entityType,
                  representative_name: kycValue.representativeName,
                  corporate_number: kycValue.corporateNumber,
                  license_number: kycValue.licenseNumber,
                  antisocial_pledged_at: new Date().toISOString(),
                  kyc_status: "pending",
        })
        .select("id")
        .single();

  // 二重送信: 最初の1件で受付済み(振込は請求書も1通だけ。カードは最初の送信の決済ページで続ける)
  if (isDuplicateRequest(insertError)) redirect(billingMethod === "bank_transfer" ? "/apply?done=review" : `/apply?error=${encodeURIComponent("お申込みを受け付けています。開いている決済ページでお手続きを続けてください。")}`);
  if (insertError || !application) {
          redirect(`/apply?error=${encodeURIComponent(insertError?.message ?? "申込みに失敗しました。")}`);
          return;
  }

  await notifyNewListingApplication(supabase, {
    companyName,
    storeName,
    matchedStoreId,
    contactName,
    email,
    tel,
    pref,
    category,
    message,
  });

  // カード: その場でKOMOJUのお支払い画面へ。お支払い後すぐに店舗管理を使い始められる。
  // 事業者の確認は支払いの後に運営が行う(総合管理の申込詳細。NGなら掲載停止・返金)。
  if (billingMethod === "card") {
    const r = await createApplyCardSession({ id: application.id, company_name: companyName, email, plan_id: planId, billing_cycle_months: billingCycle });
    if ("error" in r) {
      await createServiceRoleClient().from("listing_applications").update({ payment_status: "failed" }).eq("id", application.id);
      redirect(`/apply?error=${encodeURIComponent(r.error)}`);
    }
    redirect((r as { url: string }).url);
  }

  // 振込: 確認(本人確認・反社チェック)が済んでから、運営が請求書を送る(総合管理の申込詳細、lib/listing-kyc.ts)。
  // ここでは受付のお知らせだけを送る。
  try {
    await sendListingApplicationReceivedEmail({ to: email, companyName, contactName, billingMethod });
  } catch {
    // 受付メールが送れなくても申し込みは受け付ける(運営には通知済み)
  }
  redirect("/apply?done=review");
}
