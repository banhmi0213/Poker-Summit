import Link from "next/link";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

export const metadata = { title: "ページが見つかりません｜Poker Summit", robots: { index: false } };

// 存在しないページ・削除された店舗やクーポンなどを開いたときの画面(2026/10)
export default function NotFound() {
  return (
    <div className="portal">
      <PortalHeader />
      <main className="container" style={{ padding: "48px 16px 64px", textAlign: "center", maxWidth: 560 }}>
        <p style={{ fontSize: 13, letterSpacing: ".2em", color: "#8c6428", margin: 0 }}>PAGE NOT FOUND</p>
        <h1 style={{ fontSize: 22, margin: "10px 0 14px" }}>ページが見つかりません</h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: "#514536", margin: "0 0 26px" }}>
          お探しのページは、掲載が終了したか、
          <br />
          URLが変更された可能性があります。
        </p>
        <div style={{ display: "grid", gap: 10, maxWidth: 320, margin: "0 auto" }}>
          <Link href="/" className="btn primary" style={{ justifyContent: "center", minHeight: 48, fontSize: 15 }}>TOPへ戻る</Link>
          <Link href="/stores" className="btn" style={{ justifyContent: "center", minHeight: 46, fontSize: 15 }}>店舗を探す</Link>
          <Link href="/events" className="btn" style={{ justifyContent: "center", minHeight: 46, fontSize: 15 }}>トーナメント・イベントを探す</Link>
        </div>
      </main>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}
