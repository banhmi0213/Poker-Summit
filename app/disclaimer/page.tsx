import type { CSSProperties } from "react";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

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
        <div className="card">
          <p style={P_STYLE}>
            株式会社Give Rise（以下、「当運営」といいます。）が運営するウェブサイト（以下、「本サービス」といいます。）のご利用にあたっては、以下の免責事項をご確認ください。本サービスを利用された場合、以下の内容に同意いただいたものとみなします。
          </p>

          <h2 style={ARTICLE_STYLE}>第1条（情報の正確性について）</h2>
          <ol style={LIST_STYLE}>
            <li>
              本サービスに掲載されているアミューズメントポーカー店舗の情報、求人情報、イベント情報、クーポン、その他のコンテンツ（以下、「掲載情報等」といいます。）の正確性、最新性、安全性、有用性等について、当運営はいかなる保証も行わないものとします。
            </li>
            <li>
              掲載情報等は、店舗側の都合や予告なき変更等により、実際の状況と異なる場合があります。ご利用の際は、必ず事前に各店舗へ直接ご確認いただくものとし、当運営は掲載情報等の誤りまたは変更に起因してユーザーに生じた損害について、一切の責任を負いません。
            </li>
          </ol>

          <h2 style={ARTICLE_STYLE}>第2条（ユーザーと店舗間のトラブルについて）</h2>
          <ol style={LIST_STYLE}>
            <li>
              本サービスを介して行われるユーザーと掲載店舗との間のやり取り（求人への応募、店舗への来店、サービスの利用、クーポン・特典の利用、報酬・賃金の支払い等を含みますがこれらに限られません）については、すべて当事者間で行っていただくものとします。
            </li>
            <li>
              ユーザーと店舗の間で発生したトラブル、紛争、事故、損害等について、当運営は一切の責任を負いません。万が一、紛争等が生じた場合でも、当事者間で解決するものとし、当運営は関与いたしません。
            </li>
          </ol>

          <h2 style={ARTICLE_STYLE}>第3条（サービスの変更・中断・終了について）</h2>
          <ol style={LIST_STYLE}>
            <li>当運営は、ユーザーへの事前の通知なく、本サービスの内容の全部または一部を変更、追加、または停止・中止することができるものとします。</li>
            <li>
              システムの保守、天災地変、ネットワークの障害、その他やむを得ない事由により、本サービスの提供が遅延または中断することがあります。これらに起因してユーザーまたは第三者に生じた損害について、当運営は一切の責任を負いません。
            </li>
          </ol>

          <h2 style={ARTICLE_STYLE}>第4条（外部サイトへのリンクについて）</h2>
          <ol style={LIST_STYLE}>
            <li>
              本サービスからリンクしている外部サイト、または本サービスへリンクしている外部サイトの内容について、当運営は一切関与せず、その内容、安全性、適法性等について何ら保証するものではありません。
            </li>
            <li>外部サイトを利用したことに起因して生じた損害についても、当運営は一切の責任を負いません。</li>
          </ol>

          <h2 style={ARTICLE_STYLE}>第5条（免責事項の変更）</h2>
          <p style={P_STYLE}>
            当運営は、必要と判断した場合には、ユーザーに通知することなくいつでも本免責事項の内容を変更することができるものとします。変更後の免責事項は、本ウェブサイト上に掲示した時点から効力を生じるものとします。
          </p>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}
