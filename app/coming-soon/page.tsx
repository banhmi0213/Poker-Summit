import Link from "next/link";
import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

export const metadata: Metadata = { ...NOINDEX, title: "正式オープンから公開｜Poker Summit" };

// 先行公開中、ディーラーマッチング(スポット求人・ディーラー登録・マッチング)を開いたときの案内(2026/10/20)。
// middleware(lib/supabase/middleware.ts)がここに差し替える。
export default async function ComingSoonPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container" style={{ minHeight: "55vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 16px" }}>
        <div className="card" style={{ maxWidth: 520, width: "100%", padding: "28px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🃏</div>
          <h1 style={{ fontSize: 20, marginBottom: 10 }}>ディーラーマッチングは<br />10/25（日）の正式オープンから使えます</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 18 }}>
            スポット求人・店舗とのマッチングは、正式オープンと同時に公開します（ディーラー登録は今からできます）。
            それまでは店舗検索や国内外の大型大会情報などをお楽しみください。
          </p>
          <Link href="/" className="btn primary">トップへ戻る</Link>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}
