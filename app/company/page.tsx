import type { CSSProperties, ReactNode } from "react";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

// フッターの「運営会社概要」リンク先(2026/10/01追加、2026/10/01に本文反映)。

const LABEL_STYLE: CSSProperties = { fontSize: 15, fontWeight: 700, marginTop: 22, marginBottom: 6 };
const P_STYLE: CSSProperties = { lineHeight: 1.8 };

const ITEMS: { label: string; body: ReactNode }[] = [
  { label: "会社名", body: "株式会社Give Rise" },
  { label: "設立", body: "2022年8月10日" },
  { label: "代表取締役", body: "増田 忍" },
  { label: "所在地", body: "〒107-0062 東京都港区南青山3丁目1番36号 青山丸竹ビル6F" },
  {
    label: "連絡先",
    body: (
      <>
        お問い合わせフォームよりご連絡ください。
        <br />
        <a href="/contact">https://poker-summit.vercel.app/contact</a>
      </>
    ),
  },
  {
    label: "事業内容",
    body: (
      <>
        ・アミューズメントポーカー・ポーカーバーの全国ポータルサイトの企画・運営
        <br />
        ・店舗向けサブスクリプションサービスおよびプロモーション支援
      </>
    ),
  },
];

export default function CompanyPage() {
  return (
    <div>
      <PortalHeader />
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>運営会社概要</h1>
        <div className="card">
          {ITEMS.map((item) => (
            <div key={item.label}>
              <h2 style={LABEL_STYLE}>{item.label}</h2>
              <p style={P_STYLE}>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}
