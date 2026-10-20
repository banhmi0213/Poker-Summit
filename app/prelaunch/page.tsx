import { RegistrationPage } from "../signup/registration";
import { PriceLockNote } from "@/app/price-lock-note";
import { getPriceLockCampaign } from "@/lib/price-lock-campaign";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SITE_DESCRIPTION } from "@/lib/seo";
import { signOut } from "@/app/login/actions";
import { registerPrelaunchMHoldemId } from "./actions";
import { M_HOLDEM_ID_MAX_LENGTH } from "@/lib/m-holdem";
import { headers } from "next/headers";
import { classifyDevice, isBotUserAgent } from "@/lib/device";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// 先行登録モード中に一般向けページの代わりに出す、先行会員登録の案内ページ(2026/10)。
// middleware(lib/supabase/middleware.ts)が site_settings.prelaunch_mode のときにここへ差し替える。

export const metadata: Metadata = {
  title: "Poker Summit｜先行会員登録受付中",
  description: `まもなくオープン。${SITE_DESCRIPTION}`,
  // 先行登録モード中はトップ(/)がこのページになるので、正規URLは / と明示する(2026/10/20。
  // Googleがトップを別ドメインの重複と判断していたため)
  alternates: { canonical: "/" },
};

export default async function PrelaunchPage({searchParams}: {searchParams: {error?: string; done?: string; mhError?: string; mhDone?: string}}) {
  const supabase = await createClient();
  const [{ data: settings }, { data: auth }] = await Promise.all([
    supabase.from("site_settings").select("prelaunch_message, prelaunch_x_url, contact_email, member_preview").eq("id", true).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const loggedIn = !!auth.user;

  if (!loggedIn) {
    // 先行登録ページの表示回数を記録する(総合管理 > アクセス統計 > 先行登録、2026/10/18)。
    // 人のアクセスだけ(クローラー・リンクの先読みは除く)。送信後のエラー表示・完了表示の再表示は数えない。
    const hdrs = await headers();
    const ua = hdrs.get("user-agent");
    const isPrefetch = hdrs.get("next-router-prefetch") === "1" || hdrs.get("purpose") === "prefetch" || hdrs.get("sec-purpose")?.includes("prefetch");
    if (!isBotUserAgent(ua) && !isPrefetch && !searchParams?.error && !searchParams?.done) {
      try {
        await createServiceRoleClient()
          .from("page_views")
          .insert({ path: "/prelaunch", referrer: hdrs.get("referer") ?? null, device: classifyDevice(ua) });
      } catch {
        // 記録に失敗しても登録画面は出す
      }
    }
    const priceLock = await getPriceLockCampaign().catch(() => null);
    return RegistrationPage({searchParams, early: true, memberPreview: !!settings?.member_preview, priceLock});
  }

  const priceLockCampaign = await getPriceLockCampaign().catch(() => null);
  const priceLockNote = priceLockCampaign?.accepting && priceLockCampaign.deadlineIso ? priceLockCampaign.deadlineIso : null;
  const priceLockLabel = (priceLockCampaign?.deadlineLabel ?? "").replace(/^\d{4}年/, "");

  // 先行会員の m HOLD’EM ID(先行登録の間はマイページを開けないので、ここで登録・確認できるようにする。2026/10/19)
  const { data: mhRow } = await supabase.from("member_m_holdem_ids").select("m_holdem_id").eq("user_id", auth.user!.id).maybeSingle();
  const mHoldemId = (mhRow?.m_holdem_id as string | undefined) ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#fffaf0 0%,#f6ead2 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ width: "100%", maxWidth: 560, textAlign: "center" }}>
        <img src="/images/logo.webp" alt="Poker Summit" style={{ width: "min(320px, 80%)", height: "auto", margin: "0 auto 24px", display: "block" }} />

        <p style={{ fontSize: 13, letterSpacing: "0.2em", color: "#9a7b3c", fontWeight: 700, marginBottom: 8 }}>COMING SOON</p>
        <h1 style={{ fontSize: "clamp(22px, 5vw, 30px)", lineHeight: 1.5, marginBottom: 16 }}>
          {loggedIn ? "先行会員登録ありがとうございます" : "先行会員登録 受付中"}
        </h1>

        <div className="card" style={{ textAlign: "left", lineHeight: 1.9, marginBottom: 20 }}>
          {/* ここに来るのはログイン済みの先行会員だけ(未ログインは上で登録画面を返す) */}
          {settings?.member_preview ? (
            // 先行会員にサイトを公開中(2026/10/20)
            <>
              <p>
                先行会員としてのご登録が完了しています。先行会員の皆さまには、オープン前のサイトを先行で公開しています。
                <br />
                先行会員限定トーナメントの詳細はメールと公式Xでお知らせします。
              </p>
              <p style={{ marginTop: 12 }}>
                <Link href="/" className="btn primary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 48, padding: "12px 28px", borderRadius: 8, fontWeight: 700, color: "#382714", background: "linear-gradient(135deg,#f3dda3,#c3983c)", border: "1px solid #b68a35", textDecoration: "none", boxShadow: "0 3px 10px rgba(135,98,30,0.14)" }}>サイトを見る</Link>
              </p>
            </>
          ) : (
            <p>
              先行会員としてのご登録が完了しています。サイトのオープンまでもうしばらくお待ちください。
              <br />
              オープン日や先行会員限定トーナメントの詳細はメールと公式Xでお知らせします。
            </p>
          )}
          <div id="m-holdem-id" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee3cc", fontSize: 13.5 }}>
            <strong style={{ display: "block", marginBottom: 4 }}>m HOLD’EM ID</strong>
            {mHoldemId ? (
              <>
                <span style={{ fontSize: 16, fontWeight: 700, userSelect: "all" }}>{mHoldemId}</span>
                {searchParams?.mhDone && <span style={{ marginLeft: 8, color: "#2e7d32", fontSize: 12.5 }}>✓ 登録しました</span>}
                <span style={{ display: "block", fontSize: 12, color: "#7a6a52", marginTop: 4 }}>先行会員限定トーナメントへの参加に使います。登録後は変更できません（変更が必要な場合はお問い合わせください）。</span>
              </>
            ) : (
              <form action={registerPrelaunchMHoldemId}>
                <span style={{ display: "block", fontSize: 12.5, color: "#7a6a52", marginBottom: 8 }}>
                  先行会員限定トーナメントへの参加には登録が必要です。一度登録すると変更できませんので、お間違えのないようご入力ください。
                </span>
                {searchParams?.mhError && <p style={{ color: "#c0392b", fontSize: 12.5, margin: "0 0 8px" }} role="alert">{searchParams.mhError}</p>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input name="mHoldemId" required autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} maxLength={M_HOLDEM_ID_MAX_LENGTH} placeholder="IDを入力" style={{ flex: "1 1 180px", minWidth: 0, width: "100%", boxSizing: "border-box", minHeight: 44, fontSize: 16 }} />
                  <button type="submit" className="btn primary" style={{ minHeight: 44, padding: "0 20px", fontWeight: 700, color: "#382714", background: "linear-gradient(135deg,#f3dda3,#c3983c)", border: "1px solid #b68a35", borderRadius: 8 }}>登録する</button>
                </div>
              </form>
            )}
          </div>
          <p style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee3cc", fontSize: 13.5 }}>
            ポーカーディーラーの方はオープン前からディーラー登録ができます。
            <br />
            <Link href="/account/dealer" className="btn primary" style={{ display: "inline-flex", marginTop: 12, alignItems: "center", justifyContent: "center", minHeight: 48, padding: "12px 28px", borderRadius: 8, fontWeight: 700, color: "#382714", background: "linear-gradient(135deg,#f3dda3,#c3983c)", border: "1px solid #b68a35", textDecoration: "none", boxShadow: "0 3px 10px rgba(135,98,30,0.14)" }}>ディーラー登録はこちら</Link>
          </p>
        </div>

        {!loggedIn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", marginBottom: 20 }}>
            <Link href="/signup" className="btn primary" style={{ width: "min(320px, 100%)", fontSize: 16, padding: "14px 0" }}>
              無料で先行会員登録する
            </Link>
            <Link href="/login" className="muted" style={{ fontSize: 13 }}>
              登録済みの方はログイン
            </Link>
          </div>
        )}

        {settings?.prelaunch_x_url && (
          <p style={{ marginBottom: 20 }}>
            <a href={settings.prelaunch_x_url} target="_blank" rel="noopener noreferrer" className="btn primary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 48, padding: "12px 28px", borderRadius: 8, fontWeight: 700, color: "#382714", background: "linear-gradient(135deg,#f3dda3,#c3983c)", border: "1px solid #b68a35", textDecoration: "none", boxShadow: "0 3px 10px rgba(135,98,30,0.14)" }}>
              公式Xをフォロー
            </a>
          </p>
        )}

        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
          <p>
            ポーカー店のオーナー様・運営者様へ：<Link href="/apply">掲載のお申込み</Link>{priceLockNote && <PriceLockNote deadlineIso={priceLockNote} text={`（${priceLockLabel}までのご契約で、今後も料金据え置き）`} />}／<Link href="/store/login">店舗管理ログイン</Link>
          </p>
          <p>
            <Link href="/terms">利用規約</Link>・<Link href="/privacy">プライバシーポリシー</Link>・<Link href="/tokushoho">特定商取引法に基づく表記</Link>・<Link href="/company">運営会社</Link>
          </p>
          {settings?.contact_email && <p>お問い合わせ：{settings.contact_email}</p>}
          <p style={{ marginTop: 8 }}>© 株式会社Give Rise</p>
          {/* 共用の端末向けに、登録後の画面からログアウトできるようにする(2026/10) */}
          <form action={signOut} style={{ marginTop: 14 }}>
            <button type="submit" style={{ background: "none", border: "1px solid #d9c9a3", borderRadius: 6, padding: "6px 14px", fontSize: 12, color: "#8a6d3b", cursor: "pointer" }}>
              ログアウト
            </button>
          </form>
          {/* 先行登録中でも自分で退会できるようにする(2026/10) */}
          <p style={{ marginTop: 10, fontSize: 12 }}>
            <Link href="/account/delete" style={{ color: "#8a6d3b" }}>退会はこちら</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
