import { RegistrationPage } from "../signup/registration";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SITE_DESCRIPTION } from "@/lib/seo";

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
  const message =
    settings?.prelaunch_message ||
    "全国のアミューズメントポーカー店・トーナメント・イベント情報をまとめて探せるポーカー総合情報サイト「Poker Summit」が、まもなくオープンします。";

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
          {loggedIn ? (
            <p>
              先行会員としてのご登録が完了しています。サイトのオープンまで、もうしばらくお待ちください。
              <br />
              オープン日や先行会員限定トーナメントの詳細は、メールと公式Xでお知らせします。
            </p>
          ) : (
            <>
              <p style={{ whiteSpace: "pre-wrap", marginBottom: 14 }}>{message}</p>
              <div style={{ background: "#fff7e6", border: "1px solid #e6c98a", borderRadius: 10, padding: "12px 14px" }}>
                <strong>🏆 先行会員特典</strong>
                <br />
                先行会員限定のトーナメントを開催予定です。詳細は公式Xで発表します。
              </div>
            </>
          )}
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
            <a href={settings.prelaunch_x_url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
              最新情報は公式X(旧Twitter)で →
            </a>
          </p>
        )}

        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
          <p>
            店舗・事業者の方：<Link href="/apply">掲載のお申込み</Link>／<Link href="/store/login">店舗管理ログイン</Link>
          </p>
          <p>
            <Link href="/terms">利用規約</Link>・<Link href="/privacy">プライバシーポリシー</Link>・<Link href="/tokushoho">特定商取引法に基づく表記</Link>・<Link href="/company">運営会社</Link>
          </p>
          {settings?.contact_email && <p>お問い合わせ：{settings.contact_email}</p>}
          <p style={{ marginTop: 8 }}>© 株式会社Give Rise</p>
        </div>
      </div>
    </div>
  );
}
