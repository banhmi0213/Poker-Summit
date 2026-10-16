"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";

const failTo = (message: string): never => redirect(`/admin/reports?status=all&error=${encodeURIComponent(message)}`);
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendReportReplyEmail, sendStoreMessageEmail } from "@/lib/email";

export async function setReportStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, `report_${status}`, "report", id);
  revalidatePath("/admin/reports");
}

export async function deleteReport(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("reports").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "report_delete", "report", id);
  revalidatePath("/admin/reports");
}

/** 運営メモ(何を確認したか・どう対応したか)を保存 */
export async function saveReportMemo(id: string, formData: FormData) {
  const supabase = await createClient();
  const memo = String(formData.get("memo") ?? "").trim().slice(0, 2000) || null;
  const { error } = await supabase.from("reports").update({ admin_memo: memo }).eq("id", id);
  if (error) failTo(`メモを保存できませんでした：${error.message}`);
  await logAdminAction(supabase, "report_memo", "report", id);
  revalidatePath("/admin/reports");
}

/**
 * 通報された対象をその場で非表示/表示に戻す(掲示板の投稿・返信、求人)。
 * 非表示にしたら通報は「確認中」に進める(対応済みにするかは運営が判断)。
 */
export async function moderateReportTarget(id: string, mode: "hide" | "show") {
  const supabase = await createClient();
  const { data: report, error: readError } = await supabase.from("reports").select("target_type, target_id, status").eq("id", id).maybeSingle();
  if (readError || !report) failTo("通報が見つかりません。");
  const table =
    report!.target_type === "post" ? "board_posts" : report!.target_type === "reply" ? "board_replies" : report!.target_type === "job" ? "jobs" : null;
  if (!table) failTo("この種類の通報は、この画面から非表示にできません。");
  const value =
    report!.target_type === "job" ? (mode === "hide" ? "closed" : "open") : mode === "hide" ? "hidden" : "visible";
  const { error } = await supabase.from(table!).update({ status: value }).eq("id", report!.target_id);
  if (error) failTo(`変更できませんでした：${error.message}`);
  if (mode === "hide" && report!.status === "open") {
    await supabase.from("reports").update({ status: "investigating" }).eq("id", id);
  }
  await logAdminAction(supabase, `report_target_${mode}`, report!.target_type, report!.target_id, { report_id: id });
  revalidatePath("/admin/reports");
  revalidatePath("/board");
  revalidatePath("/jobs");
}

// ---------------------------------------------------------------------------
// 通報した人・通報された店舗への連絡(2026/10)
// ---------------------------------------------------------------------------

const TARGET_LABEL: Record<string, string> = { post: "掲示板の投稿", reply: "掲示板の返信", store: "店舗情報", job: "求人" };

/** 通報の対象から、関係する店舗(店舗そのもの・求人の店舗)を探す */
async function reportStoreId(svc: ReturnType<typeof createServiceRoleClient>, targetType: string, targetId: string) {
  if (targetType === "store") return targetId;
  if (targetType === "job") {
    const { data } = await svc.from("jobs").select("store_id").eq("id", targetId).maybeSingle();
    return (data?.store_id as string | undefined) ?? null;
  }
  return null;
}

/** 通報してくれた人にメールで返信する(info@ から。履歴に残す) */
export async function replyToReporter(id: string, formData: FormData) {
  const supabase = await createClient();
  const body = String(formData.get("body") ?? "").trim();
  const back = (m: string, ok = false): never =>
    redirect(`/admin/reports?status=${String(formData.get("status") ?? "all").replace(/[^a-z]/g, "") || "all"}&${ok ? "sent" : "error"}=${encodeURIComponent(m)}#rep-${id}`);
  if (!body) back("返信の本文を入力してください。");
  if (body.length > 5000) back("返信の本文が長すぎます(5000文字まで)。");

  const { data: report } = await supabase.from("reports").select("target_type, reporter_user_id, reporter_email").eq("id", id).maybeSingle();
  if (!report) back("通報が見つかりません。");
  let to: string | null = report!.reporter_email ?? null;
  if (!to && report!.reporter_user_id) {
    const { data } = await createServiceRoleClient().auth.admin.getUserById(report!.reporter_user_id);
    to = data.user?.email ?? null;
  }
  if (!to) back("この通報には連絡先がありません(未ログインでメールアドレスの記入もなし)。");

  try {
    await sendReportReplyEmail({ to: to!, body, targetLabel: TARGET_LABEL[report!.target_type] ?? "ご報告" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    back(`メールを送れませんでした（宛先：${to}）。${/example\.com|Invalid `to`/i.test(msg) ? "テスト用・存在しないアドレスには送れません。" : msg.slice(0, 160)}`);
  }
  const { data: me } = await supabase.auth.getUser();
  await supabase.from("report_replies").insert({ report_id: id, kind: "reporter", body, sent_to: to, sent_by: me.user?.id ?? null, sent_by_email: me.user?.email ?? null });
  await logAdminAction(supabase, "report_reply_reporter", "report", id);
  revalidatePath("/admin/reports");
  back("通報した方にメールを送りました。", true);
}

/** 通報された店舗に連絡する(店舗管理の「運営からのお知らせ」+契約の連絡先メール。通報者の情報は載せない) */
export async function contactReportedStore(id: string, formData: FormData) {
  const supabase = await createClient();
  const svc = createServiceRoleClient();
  const title = String(formData.get("title") ?? "").trim().slice(0, 100) || "掲載内容のご確認のお願い";
  const body = String(formData.get("body") ?? "").trim();
  const back = (m: string, ok = false): never =>
    redirect(`/admin/reports?status=${String(formData.get("status") ?? "all").replace(/[^a-z]/g, "") || "all"}&${ok ? "sent" : "error"}=${encodeURIComponent(m)}#rep-${id}`);
  if (!body) back("お知らせの本文を入力してください。");
  if (body.length > 5000) back("お知らせの本文が長すぎます(5000文字まで)。");

  const { data: report } = await supabase.from("reports").select("target_type, target_id").eq("id", id).maybeSingle();
  if (!report) back("通報が見つかりません。");
  const storeId = await reportStoreId(svc, report!.target_type, report!.target_id);
  if (!storeId) back("この通報には連絡できる店舗がありません。");
  const [{ data: store }, { data: contract }] = await Promise.all([
    svc.from("stores").select("name, owner_user_id").eq("id", storeId!).maybeSingle(),
    svc.from("store_contracts").select("contact_email").eq("store_id", storeId!).eq("status", "active").maybeSingle(),
  ]);
  if (!store?.owner_user_id) back("この店舗は契約店舗ではないため、店舗管理画面がありません。「店舗情報を直す」から運営で直してください。");

  const { error: inboxError } = await svc.from("store_messages").insert({ store_id: storeId!, title, body });
  if (inboxError) back(`お知らせを保存できませんでした：${inboxError.message}`);
  let mailNote = "";
  if (contract?.contact_email) {
    try {
      await sendStoreMessageEmail({ to: contract.contact_email, storeName: store!.name as string, title, body });
      mailNote = "・メール";
    } catch {
      mailNote = "（メールは送れませんでした）";
    }
  }
  const { data: me } = await supabase.auth.getUser();
  await supabase.from("report_replies").insert({
    report_id: id,
    kind: "store",
    body: `【${title}】\n${body}`,
    sent_to: contract?.contact_email ?? `${store!.name}(店舗管理)`,
    sent_by: me.user?.id ?? null,
    sent_by_email: me.user?.email ?? null,
  });
  await logAdminAction(supabase, "report_contact_store", "report", id, { store_id: storeId });
  revalidatePath("/admin/reports");
  back(`店舗に連絡しました（店舗管理の「運営からのお知らせ」${mailNote}）。`, true);
}
