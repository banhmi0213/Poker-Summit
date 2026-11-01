"use server";

import { revalidatePath, revalidatePublicData } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function approveApplication(id: string) {
  const supabase = await createClient();

  const { data: application, error: fetchError } = await supabase
    .from("listing_applications")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !application) {
    throw new Error(fetchError?.message ?? "申込が見つかりません。");
  }

  const { data: store, error: insertError } = await supabase
    .from("stores")
    .insert({
      name: application.company_name,
      category: application.category,
      pref: application.pref,
      tel: application.tel,
      // 契約なしで承認される無料掲載のケースはstore_contractsが作られず
      // トリガー(sync_store_email_from_contract)経由の反映が効かないため、
      // ここで直接stores.emailに引き継ぐ(2026/10、「取り込んだ店舗のメールを
      // まとめて保管したい」との相談を受けて追加)。
      email: application.email || null,
      status: "pending",
      source_application_id: application.id,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { error: updateError } = await supabase
    .from("listing_applications")
    .update({ status: "approved", store_id: store.id })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await logAdminAction(supabase, "application_approve", "listing_application", id, {
    storeId: store.id,
  });

  revalidatePath("/admin/listing-applications");
  revalidatePublicData();
  revalidatePath("/admin/stores");
}

export async function rejectApplication(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("listing_applications")
    .update({ status: "rejected" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "application_reject", "listing_application", id);

  revalidatePath("/admin/listing-applications");
}

export async function revertApplication(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("listing_applications")
    .update({ status: "pending" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "application_revert", "listing_application", id);

  revalidatePath("/admin/listing-applications");
  revalidatePublicData();
}

// 事業者の確認(本人確認・反社会的勢力のチェック、2026/10/21)。運営が確認した項目・メモ・確認者・日時を残す。
// 確認OKのときだけ、請求書(振込)・お支払いページの案内(カード)を送る(lib/listing-kyc.ts)。
export async function reviewApplicationKyc(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) throw new Error("権限がありません。");
  const { data: { user } } = await supabase.auth.getUser();
  const decision = String(formData.get("decision") ?? "");
  const { data: a } = await supabase.from("listing_applications").select("id, entity_type, kyc_status, payment_status, billing_method, store_id").eq("id", id).maybeSingle();
  if (!a) throw new Error("申込が見つかりません。");
  const corp = formData.get("corpChecked") === "on";
  const identity = formData.get("identityChecked") === "on";
  const news = formData.get("newsChecked") === "on";
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000) || null;
  const { redirect } = await import("next/navigation");
  const back = (msg: string) => redirect(`/admin/listing-applications/${id}?kyc=${encodeURIComponent(msg)}`);

  if (decision === "ok") {
    const missing: string[] = [];
    if (a.entity_type === "corporation" && !corp) missing.push("法人番号の照合");
    if (a.entity_type === "individual" && !identity) missing.push("代表者の本人確認");
    if (!news) missing.push("公開情報（報道等）の確認");
    if (missing.length) back(`確認OKにするには、次の確認が必要です: ${missing.join("・")}`);
  }
  const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
  const svc = createServiceRoleClient();
  await svc
    .from("listing_applications")
    .update({
      kyc_status: decision === "ok" ? "ok" : "ng",
      kyc_corp_checked: corp,
      kyc_identity_checked: identity,
      kyc_news_checked: news,
      kyc_note: note,
      kyc_checked_by: user?.id ?? null,
      kyc_checked_email: user?.email ?? null,
      kyc_checked_at: new Date().toISOString(),
      ...(decision === "ok" ? {} : { status: "rejected", payment_status: "rejected_review" }),
    })
    .eq("id", id);
  await logAdminAction(supabase, decision === "ok" ? "application_kyc_ok" : "application_kyc_ng", "listing_application", id, { corp, identity, news, note });

  let message = decision === "ok" ? "確認OKにしました。" : "確認NGにして、お申し込みを却下しました（申込者への連絡は個別にお願いします）。";
  // カード払いですでに使い始めている店(支払い後に確認する流れ)がNGなら、店舗をすぐ非公開にする。返金・契約の解除は手で行う
  if (decision !== "ok" && a.store_id) {
    await svc.from("stores").update({ status: "closed", google_match_note: "事業者の確認NGのため掲載停止(2026/10/21〜の確認フロー)" }).eq("id", a.store_id);
    message = "確認NGにして、店舗を非公開にしました。返金と契約の解除（KOMOJU・契約管理）、申込者への連絡は手でお願いします。";
  }
  if (decision === "ok" && a.payment_status === "awaiting_review") {
    const { releasePaymentAfterReview } = await import("@/lib/listing-kyc");
    const err = await releasePaymentAfterReview(id);
    message = err ? `確認OKにしましたが、案内を送れませんでした: ${err}` : "確認OKにして、請求書・お支払いの案内を送りました。";
  }
  revalidatePath("/admin/listing-applications");
  back(message);
}
