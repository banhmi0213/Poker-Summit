"use server";
import { isPrelaunchActive } from "@/lib/prelaunch";

import { revalidatePath, revalidatePublicData } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function setMemberSuspended(userId: string, suspended: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_member_suspended", {
    p_user_id: userId,
    p_suspended: suspended,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(
    supabase,
    suspended ? "member_suspend" : "member_unsuspend",
    "member",
    userId
  );
  revalidatePath("/admin/members");
  revalidatePublicData();
  revalidatePath(`/admin/members/${userId}`);
}

export async function deleteMember(userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_member", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "member_delete", "member", userId);
  revalidatePath("/admin/members");
  revalidatePublicData();
}

export async function sendMemberPasswordReset(email: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://pokersummit.jp/account/password",
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "member_password_reset_sent", "member", userId);
  revalidatePath(`/admin/members/${userId}`);
}

/**
 * 会員のメールアドレスを運営が「確認済み」にする(2026/10/18)。
 * 確認メールが携帯キャリア・Yahooメール等で遅れて届かず、リンクの期限が切れてしまった人の救済用。
 * 確認済みにしたあと、まだ送っていなければ「登録が完了しました」メールを送る(ログインできることを本人に伝えるため)。
 */
export async function confirmMemberEmail(userId: string): Promise<void> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) throw new Error("運営のみ操作できます。");
  const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
  const svc = createServiceRoleClient();
  const { data: got, error: getErr } = await svc.auth.admin.getUserById(userId);
  if (getErr || !got.user) throw new Error(getErr?.message ?? "会員が見つかりません。");
  let user = got.user;
  if (!user.email_confirmed_at) {
    const { data: upd, error } = await svc.auth.admin.updateUserById(userId, { email_confirm: true });
    if (error) throw new Error(error.message);
    if (upd.user) user = upd.user;
  }
  if (user.email && !user.user_metadata?.welcome_email_sent_at) {
    const { sendWelcomeEmail, freerollNoticeOpen, sendFreerollRoomEmail } = await import("@/lib/email");
    const { data: flags } = await svc.from("site_settings").select("prelaunch_mode, prelaunch_ends_at, prelaunch_x_url, member_preview").eq("id", true).maybeSingle();
    await sendWelcomeEmail({
      to: user.email,
      name: (user.user_metadata?.display_name as string | undefined) ?? null,
      prelaunch: isPrelaunchActive(flags),
          memberPreview: !!flags?.member_preview,
      xUrl: (flags?.prelaunch_x_url as string | null | undefined) ?? null,
    });
    // 10/25 20:00までに登録が完了した人には、先行会員限定トーナメントの部屋IDも送る(2026/10/24)
    let freerollSentAt: string | undefined;
    if (!user.email.endsWith("@login.poker-summit.jp") && freerollNoticeOpen() && !user.user_metadata?.freeroll_email_sent_at) {
      try {
        await sendFreerollRoomEmail({ to: user.email, name: (user.user_metadata?.display_name as string | undefined) ?? null });
        freerollSentAt = new Date().toISOString();
      } catch {
        // 送れなくても確認済みにする操作は続ける
      }
    }
    await svc.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...user.user_metadata,
        welcome_email_sent_at: new Date().toISOString(),
        ...(freerollSentAt ? { freeroll_email_sent_at: freerollSentAt } : {}),
      },
    });
  }
  await logAdminAction(supabase, "member_email_confirm", "member", userId);
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${userId}`);
}

/** 会員の m HOLD'EM ID を運営が訂正する(本人は登録後に変更できないため。2026/10/19)。空にすると削除 */
export async function adminSetMemberMHoldemId(userId: string, formData: FormData): Promise<void> {
  const supabase = await createClient();
  const value = String(formData.get("mHoldemId") ?? "").trim();
  const { error } = await supabase.rpc("admin_set_member_m_holdem_id", { p_user_id: userId, p_id: value });
  if (error) throw new Error(error.message);
  await logAdminAction(supabase, value ? "member_m_holdem_id_set" : "member_m_holdem_id_clear", "member", userId);
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${userId}`);
}
