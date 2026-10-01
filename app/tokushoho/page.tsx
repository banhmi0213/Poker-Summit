import type { CSSProperties, ReactNode } from "react";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

// フッターの「特定商取引法に基づく表記」リンク先(2026/10/01追加、
// 2026/10/01に本文反映)。

const LABEL_STYLE: CSSProperties = { fontSize: 15, fontWeight: 700, marginTop: 22, marginBottom: 6 };
const P_STYLE: CSSProperties = { lineHeight: 1.8 };

const ITEMS: { label: string; body: ReactNode }[] = [
  { label: "販売業者", body: "株式会社Give Rise" },
  { label: "運営責任者", body: "増田 忍" },
  { label: "所在地", body: "〒107-0062 東京都港区南青山3丁目1番36号 青山丸竹ビル6F" },
  {
    label: "連絡先（電話番号）",
    body: (
      <>
        090-3253-4029
        <br />
        ※お問い合わせは原則としてお問い合わせフォームよりお願いしております。
      </>
    ),
  },
  {
    label: "連絡先（お問い合わせフォーム）",
    body: <a href="/contact">https://poker-summit.vercel.app/contact</a>,
  },
  { label: "販売価格（役務対価）", body: "各プラン・サービスページに表示される価格（消費税込み）によります。" },
  {
    label: "商品代金以外の必要料金",
    body: "インターネット接続料金、通信料金、その他お客様の環境に応じて発生する費用はお客様のご負担となります。",
  },
  { label: "支払方法", body: "クレジットカード決済、その他当社が指定する決済方法" },
  {
    label: "支払時期",
    body: "各決済方法において定められた期日に支払われるものとします。（月額サブスクリプションの場合は毎月の更新日に自動決済）",
  },
  { label: "サービス提供時期", body: "利用登録および決済完了後、直ちにご利用いただけます。" },
  {
    label: "返品・キャンセルに関する特約",
    body: "デジタルコンテンツ・サービスという商品の性質上、購入手続き完了後におけるキャンセル、返品、返金はお受けしておりません。また、月額プランの途中解約による日割り返金等も行いませんのでご了承ください。",
  },
];

export default function TokushohoPage() {
  return (
    <div>
      <PortalHeader />
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>特定商取引法に基づく表記</h1>
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
