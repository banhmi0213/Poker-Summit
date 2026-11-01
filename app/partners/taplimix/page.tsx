import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

const TAPLIMIX_URL = "https://taplimix.app/?utm_source=PokerSummit&utm_medium=banner";

export const metadata: Metadata = {
  title: "TapliMIX（タプリミックス）｜提携サービス｜Poker Summit",
  description: "100種類以上のMIXゲームを搭載するオンライン対戦アプリ「TapliMIX」をご紹介。プライベートルームでの対戦やコーチングにも対応しています。",
  alternates: { canonical: "/partners/taplimix" },
};

export default async function TapliMixPartnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <main className="container" style={{ maxWidth: 1040, paddingTop: 30, paddingBottom: 64 }}>
        <nav aria-label="パンくずリスト" style={{ fontSize: 13, marginBottom: 24, color: "#777" }}>
          <Link href="/">TOP</Link> <span aria-hidden="true"> / </span> 提携サービス <span aria-hidden="true"> / </span> TapliMIX
        </nav>
        <section style={{ background: "linear-gradient(120deg,#fffefb,#f8f2e5)", border: "1px solid #dfc58d", borderRadius: 18, padding: "clamp(24px,5vw,54px)", textAlign: "center" }}>
          <p style={{ color: "#896923", fontSize: 13, fontWeight: 700, letterSpacing: ".15em", marginBottom: 14 }}>POKER SUMMIT PARTNER</p>
          <h1 style={{ fontSize: "clamp(32px,6vw,54px)", lineHeight: 1.2, margin: "0 0 10px", fontWeight: 800 }}>TapliMIX</h1>
          <p style={{ fontSize: 17, margin: "0 0 22px" }}>タプリミックス</p>
          <p style={{ margin: "0 auto 26px", maxWidth: 620, fontSize: "clamp(16px,2.5vw,20px)", lineHeight: 1.8 }}>100種類以上のMIXゲームを楽しめる<br />オンライン対戦アプリ</p>
          <a href={TAPLIMIX_URL} target="_blank" rel="noopener noreferrer sponsored" style={{ display: "inline-block", padding: "15px 36px", background: "#173b75", color: "#fff", borderRadius: 9, textDecoration: "none", fontWeight: 700 }}>TapliMIX公式サイトへ ↗</a>
        </section>
        <section style={{ padding: "clamp(26px,5vw,42px) 4px" }}>
          <h2 style={{ fontSize: 24, marginBottom: 16 }}>TapliMIXとは？</h2>
          <p style={{ fontSize: 16, lineHeight: 2, margin: 0 }}>TapliMIX（タプリミックス）は、多彩なミックスゲームポーカーを毎日真剣勝負で遊べるオンライン対戦アプリです。100種類以上のMIXゲームを搭載し、プライベートルームでの対戦やコーチングにもご利用頂けます。</p>
        </section>
        <section aria-label="主な特徴" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 42 }}>
          {[
            ["100種類以上のMIXゲーム","多彩なミックスゲームポーカーに対応。"],
            ["オンライン対戦","毎日真剣勝負を楽しめるアプリ。"],
            ["プライベートルーム","仲間との対戦やコーチングにも利用可能。"],
          ].map(([title, detail]) => (
            <article key={title} style={{ borderRadius: 12, border: "1px solid #e9dfce", background: "#fff", padding: 23 }}>
              <h3 style={{ fontSize: 18, marginBottom: 12, color: "#7e5b15" }}>{title}</h3>
              <p style={{ lineHeight: 1.8, margin: 0 }}>{detail}</p>
            </article>
          ))}
        </section>
        <section style={{ background: "#faf8f3", borderRadius: 12, padding: "26px clamp(20px,4vw,36px)", marginBottom: 35 }}>
          <h2 style={{ fontSize: 21, marginBottom: 12 }}>Poker Summit × TapliMIX</h2>
          <p style={{ lineHeight: 1.9, margin: 0 }}>Poker SummitとTapliMIXは、サービス紹介や相互送客を通じ、ポーカーを楽しむ皆さまへ情報を届ける取り組みを進めています。</p>
        </section>
        <div style={{ textAlign: "center" }}>
          <a href={TAPLIMIX_URL} target="_blank" rel="noopener noreferrer sponsored" style={{ display: "inline-block", background: "#173b75", color: "#fff", borderRadius: 9, padding: "15px 36px", fontWeight: 700, textDecoration: "none" }}>TapliMIXを利用する ↗</a>
          <p style={{ marginTop: 16, fontSize: 13, color: "#777" }}>外部サイト（TapliMIX公式サイト）へ移動します。</p>
          <Link href="/" style={{ display: "inline-block", marginTop: 18 }}>← Poker Summit TOPへ戻る</Link>
        </div>
      </main>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}
