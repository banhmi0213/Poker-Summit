"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createFincodeCustomer, createFincodeCardRegistration, createFincodePlan } from "@/lib/fincode";
import { sendListingApplicationNotificationEmail } from "@/lib/email";

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

export async function submitApplication(formData: FormData) {
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

  const companyName = String(formData.get("companyName") ?? "").trim();
      const contactName = String(formData.get("contactName") ?? "").trim();
      const tel = String(formData.get("tel") ?? "").trim();
      const email = String(formData.get("email") ?? "").trim();
      const pref = String(formData.get("pref") ?? "").trim();
      const category = String(formData.get("category") ?? "").trim();
      const message = String(formData.get("message") ?? "").trim();

  if (!companyName || !contactName || !email) {
          redirect(
                    `/apply?error=${encodeURIComponent(
                                "店舗名・会社名、担当者名、メールアドレスは必須です。"
                              )}`
                  );
  }

  const { error } = await supabase.from("listing_applications").insert({
          company_name: companyName,
          contact_name: contactName,
          tel: tel || null,
          email,
          pref: pref || null,
          category: category || null,
          message: message || null,
  });

  if (error) {
          redirect(`/apply?error=${encodeURIComponent(error.message)}`);
  }

  await notifyNewListingApplication(supabase, {
    companyName,
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
// プランを選んでその場でクレカ契約するルート(セルフサーブ)
//
// 1. listing_applications行を作成(plan_id付き、payment_status='awaiting_card')
// 2. fincode顧客を作成
// 3. fincodeのカード登録(hosted page)へリダイレクト
// カード登録完了後はfincodeがapp/apply/complete(return_url)へPOSTで
// 戻してくるので、そこで初回課金〜店舗自動作成〜ログイン/LINE連携コード
// 発行までを行う(lib/store-provision.ts)。
// ---------------------------------------------------------------------------

function getSiteUrl(): string {
      if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
      if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
              return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
      }
      if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
      return "http://localhost:3000";
}

export async function startPaidApplication(formData: FormData) {
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

  const companyName = String(formData.get("companyName") ?? "").trim();
      const contactName = String(formData.get("contactName") ?? "").trim();
      const tel = String(formData.get("tel") ?? "").trim();
      const email = String(formData.get("email") ?? "").trim();
      const pref = String(formData.get("pref") ?? "").trim();
      const category = String(formData.get("category") ?? "").trim();
      const message = String(formData.get("message") ?? "").trim();
      const planId = String(formData.get("planId") ?? "").trim();

  if (!companyName || !contactName || !email) {
          redirect(
                    `/apply?error=${encodeURIComponent("店舗名・会社名、担当者名、メールアドレスは必須です。")}`
                  );
  }
      if (!planId) {
              redirect(`/apply?error=${encodeURIComponent("プランを選択してください。")}`);
      }

  // plan_idの実在確認は通常のRLSクライアントで(公開読み取り可のactiveプランのみ)。
  const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("id, name, monthly_fee, fincode_plan_id, active")
        .eq("id", planId)
        .maybeSingle();

  if (planError || !plan || !plan.active) {
          redirect(`/apply?error=${encodeURIComponent("選択されたプランが見つかりません。")}`);
  }

  const { data: application, error: insertError } = await supabase
        .from("listing_applications")
        .insert({
                  company_name: companyName,
                  contact_name: contactName,
                  tel: tel || null,
                  email,
                  pref: pref || null,
                  category: category || null,
                  message: message || null,
                  plan_id: planId,
                  payment_status: "awaiting_card",
        })
        .select("id")
        .single();

  if (insertError || !application) {
          redirect(`/apply?error=${encodeURIComponent(insertError?.message ?? "申込みに失敗しました。")}`);
          return;
  }

  await notifyNewListingApplication(supabase, {
    companyName,
    contactName,
    email,
    tel,
    pref,
    category,
    message,
  });

  // redirect()はNext.js内部で例外を投げて実現される仕組みなので、
  // try/catchの中では絶対に呼ばない(catchでもみ消してしまう)。
  // fincode呼び出し部分だけをtry/catchし、リダイレクト先URLが決まって
  // からtryの外でredirect()する。
  let redirectTo: string | null = null;
      let failureMessage: string | null = null;

  try {
          // fincode側のプランが未作成なら、うちのplans行の内容でこの場で作成し
        // plans.fincode_plan_idにキャッシュする(admin_users以外は書けないため
        // service-roleで)。
        let fincodePlanId = plan!.fincode_plan_id as string | null;
          if (!fincodePlanId) {
                    const created = await createFincodePlan({ name: plan!.name, monthlyFee: plan!.monthly_fee });
                    fincodePlanId = created.id;
                    const svc = createServiceRoleClient();
                    await svc.from("plans").update({ fincode_plan_id: fincodePlanId }).eq("id", planId);
          }

        const customer = await createFincodeCustomer({ name: contactName, email, phoneNo: tel || null });

        const svc = createServiceRoleClient();
          await svc
            .from("listing_applications")
            .update({ fincode_customer_id: customer.id })
            .eq("id", application.id);

        const returnBase = `${getSiteUrl()}/apply/complete/callback?application=${application.id}`;
          const registration = await createFincodeCardRegistration({
                    customerId: customer.id,
                    returnUrl: returnBase,
                    // fincode側の制約でURLは256文字までなので、メッセージは短くしておく
                    // (長い日本語メッセージをencodeURIComponentすると簡単に超える)。
                    returnUrlOnFailure: `${getSiteUrl()}/apply?error=${encodeURIComponent(
                                "カード登録に失敗しました"
                              )}`,
          });

        if (!registration.redirect_url) {
                  throw new Error("fincodeからカード登録ページのURLが返されませんでした。");
        }

        redirectTo = registration.redirect_url;
  } catch (e) {
          failureMessage = e instanceof Error ? e.message : "決済準備に失敗しました。";
  }

  if (failureMessage) {
          const svc = createServiceRoleClient();
          await svc
            .from("listing_applications")
            .update({ payment_status: "failed" })
            .eq("id", application.id);
          redirect(`/apply?error=${encodeURIComponent(failureMessage)}`);
  }

  redirect(redirectTo!);
}
