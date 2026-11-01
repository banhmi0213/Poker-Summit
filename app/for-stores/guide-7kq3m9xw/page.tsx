import type { Metadata } from "next";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { StoreGuide } from "@/app/store-guide/guide";

// 営業メールで送る店舗管理ガイド(2026/10/22)。URLを知っている人だけが見られる非公開のページ:
// サイトのどこからもリンクせず、サイトマップにも入れず、検索エンジンにも載せない(noindex)。
export const metadata: Metadata = {
  title: "店舗管理ガイド｜Poker Summit",
  robots: { index: false, follow: false, nocache: true },
};

export default function StoreGuidePublicPage() {
  return (
    <div>
      <PortalHeader />
      <main className="container" style={{ maxWidth: 820, paddingTop: 20, paddingBottom: 40 }}>
        <StoreGuide />
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <a href="/apply" className="btn primary">掲載プランの詳細・お申し込み</a>
        </div>
      </main>
      <PortalFooter />
    </div>
  );
}
