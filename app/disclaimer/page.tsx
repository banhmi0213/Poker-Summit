import type { CSSProperties } from "react";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { staticPageMetadata } from "@/lib/seo";

export const metadata = staticPageMetadata({ title: "免責事項", description: "Poker Summitの免責事項。", path: "/disclaimer" });

// フッターの「免責事項」リンク先(2026/10/01追加、2026/10/01に本文反映)。

const ARTICLE_STYLE: CSSProperties = { fontSize: 16, marginTop: 24, marginBottom: 10 };
const LIST_STYLE: CSSProperties = { margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.8 };
const P_STYLE: CSSProperties = { lineHeight: 1.8, marginTop: 8 };

export default function DisclaimerPage() {
  return (
    <div>
      <PortalHeader />
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>免責事項</h1>
        <p style={{ fontSize: 12 }}>最終改定日：2026年10月7日</p>
        <div className="card">
          <p style={P_STYLE}>
            株式会社Give Rise（以下、「当運営」といいます。）が運営するウェブサイト（以下、「本サービス」といいます。）のご利用にあたっては、以下の免責事項をご確認ください。本免責事項は利用規約と併せて適用されます。内容が抵触する場合は利用規約および適用法令が優先します。
          </p>

          <h2 style={ARTICLE_STYLE}>第1条（情報の正確性について）</h2>
          <ol style={LIST_STYLE}>
            <li>
              本サービスに掲載されているアミューズメントポーカー店舗の情報、求人情報、イベント情報、クーポン、その他のコンテンツ（以下、「掲載情報等」といいます。）の正確性、最新性、安全性、有用性等について、当運営はいかなる保証も行わないものとします。
            </li>
            <li>
              掲載情報等は、店舗側の都合や予告なき変更等により、実際の状況と異なる場合があります。ご利用の際は事前に各店舗へご確認ください。ディーラーマッチングに関する確認は、利用規約に定める連絡方法に従ってください。当運営は、掲載情報について誤りや法令違反等を把握した場合、必要に応じて確認、訂正の要請または掲載停止等を行います。
            </li>
          </ol>

          <h2 style={ARTICLE_STYLE}>第2条（ユーザーと店舗間のトラブルについて）</h2>
          <ol style={LIST_STYLE}>
            <li>
              本サービスを介して行われるユーザーと掲載店舗との間のやり取り（求人への応募、店舗への来店、サービスの利用、クーポン・特典の利用、報酬・賃金の支払い等を含みますがこれらに限られません）については、すべて当事者間で行っていただくものとします。
            </li>
            <li>
              当運営は店舗とユーザー間の契約の当事者ではなく、採用、勤務条件、報酬・賃金の支払いまたは契約履行を保証しません。当事者間の紛争は当事者が対応するものとしますが、当運営は通報受付、規約違反の調査、必要な利用制限および適法な照会への対応等を行うことがあります。運営への相談は、法的な請求や公的機関への相談を妨げません。
            </li>
          </ol>

          <h2 style={ARTICLE_STYLE}>第3条（サービスの変更・中断・終了について）</h2>
          <ol style={LIST_STYLE}>
            <li>サービスの変更、停止または終了に関する通知および手続は、利用規約に従います。</li>
            <li>
              システムの保守、天災地変、ネットワークの障害、その他やむを得ない事由により、本サービスの提供が遅延または中断することがあります。これらに関する当運営の責任は、利用規約および適用法令に従います。
            </li>
          </ol>

          <h2 style={ARTICLE_STYLE}>第4条（外部サイトへのリンクについて）</h2>
          <ol style={LIST_STYLE}>
            <li>
              本サービスからリンクしている外部サイト、または本サービスへリンクしている外部サイトの内容について、当運営は一切関与せず、その内容、安全性、適法性等について何ら保証するものではありません。
            </li>
            <li>外部サイトの利用に関する当運営の責任は、利用規約および適用法令に従います。</li>
          </ol>

          <h2 style={ARTICLE_STYLE}>第5条（免責事項の変更）</h2>
          <p style={P_STYLE}>
            本免責事項の変更は、利用規約に定める規約変更手続および適用法令に従います。
          </p>
          <h2 style={ARTICLE_STYLE}>第6条（免責の限界）</h2>
          <p style={P_STYLE}>本免責事項は、当運営の責めに帰すべき事由について適用法令に基づき当運営が負う責任を免除するものではありません。当運営の故意もしくは重大な過失による責任、または消費者契約法その他の強行法規により免除・制限できない責任には、免責を適用しません。ディーラーマッチングの責任範囲、連絡方法および通報対応については、利用規約第12条から第18条をご確認ください。</p>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}
