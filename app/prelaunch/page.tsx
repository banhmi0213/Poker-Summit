import { RegistrationPage } from "../signup/registration";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SITE_DESCRIPTION } from "@/lib/seo";
import { signOut } from "@/app/login/actions";

// 先行登録モード中に一般向けページの代わりに出す、先行会員登録の案内ページ(2026/10)。
// middleware(lib/supabase/middleware.ts)が site_settings.prelaunch_mode のときにここへ差し替える。

export const metadata: Metadata = {
  title: "Poker Summit｜先行会員登録受付中",
  description: `まもなくオープン。${SITE_DESCRIPTION}`,
};

export default async function PrelaunchPage({searchParams}: {searchParams: {error?: string; done?: string}}) {
  const supabase = await createClient();
  const [{ data: settings }, { data: auth }] = await Promise.all([
    supabase.from("site_settings").select("prelaunch_message, prelaunch_x_url, contact_email").eq("id", true).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const loggedIn = !!auth.user;

  if (!loggedIn) return RegistrationPage({searchParams, early: true});

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
          <p>
            先行会員としてのご登録が完了しています。サイトのオープンまでもうしばらくお待ちください。
            <br />
            オープン日や先行会員限定トーナメントの詳細はメールと公式Xでお知らせします。
          </p>
          <p style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee3cc", fontSize: 13.5 }}>
            ポーカーディーラーの方はオープン前からディーラー登録ができます。
            <br />
            <Link href="/account/dealer" style={{ fontWeight: 700 }}>ディーラー登録はこちら →</Link>
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
              公式Xをフォロー →
            </a>
          </p>
        )}

        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
          <p>
            ポーカー店のオーナー様・運営者様へ：<Link href="/apply">掲載のお申込み</Link>／<Link href="/store/login">店舗管理ログイン</Link>
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
