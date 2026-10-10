import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// 認証メールのリンクの受け口(2026/10)。Supabaseのメールテンプレートから
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<種類>&next=<戻り先>
// で呼ばれる。確認できたらログイン状態にして next へ。
// 会員登録の確認(type=signup/email)のときは「登録が完了しました」メールを1回だけ送る。
const SAFE_NEXT = /^\/(?!\/)[\w\-./?=&%]*$/;

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next") ?? "";
  const defaultNext = type === "recovery" ? "/account/password" : "/mypage";
  const next = SAFE_NEXT.test(nextParam) ? nextParam : defaultNext;

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("リンクが正しくありません。")}`, url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("リンクの有効期限が切れているか、すでに使用されています。もう一度お試しください。")}`,
        url.origin
      )
    );
  }

  if ((type === "signup" || type === "email") && !data.user.user_metadata?.welcome_email_sent_at) {
    try {
      if (data.user.email) {
        await sendWelcomeEmail({
          to: data.user.email,
          name: (data.user.user_metadata?.display_name as string | undefined) ?? null,
        });
      }
      await createServiceRoleClient().auth.admin.updateUserById(data.user.id, {
        user_metadata: { ...data.user.user_metadata, welcome_email_sent_at: new Date().toISOString() },
      });
    } catch {
      // 送れなくても登録自体は完了させる
    }
    return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}welcome=1`, url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
