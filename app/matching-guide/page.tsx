import Link from "next/link";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

const sections = [
 { title: "店舗とディーラーをつなぐサービス", lines: ["店舗が募集情報を掲載し、ディーラーが応募するほか、店舗からディーラーへオファーして相談できます。採用判断、契約と報酬の支払いは当事者が行います。運営は採用・勤務指示・支払いを代行しません。", "チャット等の新機能は提供開始後に利用できます。このガイドへの記載だけで機能の公開を意味するものではありません。"] },
 { title: "仕事を始める前に確認すること", lines: ["雇用か業務委託か、仕事内容、勤務場所、日付・時間、報酬の計算方法、交通費、支払日と支払方法を確認し、保存できる形で残してください。業務委託という名前だけで実際の働き方が変わるわけではありません。", "利用規約への同意と、相手の勤務条件への承諾は別です。応募やチャットの開始だけで仕事が決まるわけではありません。条件を変更する場合は、変更点を伝えて相手の確認・合意を得てください。"] },
 { title: "連絡先交換と外部取引のルール", lines: ["相談や条件確認はサイト内の連絡機能を使ってください。「LINEで続きの話をしよう」「履歴を残さず直接決めよう」など、所定の手続きを回避する目的の外部誘導は禁止です。IDを画像・分割文字・隠語で送る行為も同じです。", "法令上必要な契約手続や最小限の本人確認、生命・身体の安全のための緊急連絡まで禁止するものではありません。必要性と共有方法を確認してください。合意した契約の締結や適法な報酬・賃金の支払い自体は禁止していません。"] },
 { title: "送ってはいけない情報・メッセージ", lines: ["マイナンバー、カード番号、暗証番号、パスワード、本人確認書類の全面画像はチャットに送らないでください。不要な私生活の情報も共有しないでください。", "性的な誘い、威圧・脅迫、誹謗中傷、差別、しつこい連絡、関係のない営業・投資勧誘は禁止です。プロフィール写真は任意で、用意されたシルエットも選べます。"] },
 { title: "困ったとき・キャンセルが必要なとき", lines: ["連絡先の聞き出し、ハラスメント、虚偽の募集や未払い等があれば、相手の名称、対象の求人、日時と経緯をお問い合わせフォームからお知らせください。提供されている場合は通報・ブロック機能も利用できます。", "ブロックや退会で既に合意した契約・支払義務が消えるわけではありません。遅刻やキャンセルは速やかに連絡し、事情を踏まえて相談してください。運営は解決や支払いを保証できませんが、通報を受けて規約違反を確認します。", "危険が迫る場合は運営の返答を待たず警察等へ、労務上の問題は労働局・労働基準監督署等へ相談してください。"] },
 { title: "情報の公開と運営による確認", lines: ["公開設定を有効にしたディーラープロフィールは店舗アカウントに表示され、一般会員には表示されません。店舗は募集に必要な範囲だけで使い、転載や無断転送をしないでください。", "通報対応や安全確保等のため、権限を有する運営担当者が必要な履歴等を確認する場合があります。同意記録やチャット履歴の扱い・保存はプライバシーポリシーをご確認ください。"] },
];
export default function MatchingGuidePage() {
 return <><PortalHeader /><main className="container" style={{ maxWidth: 760 }}>
  <Link href="/">← TOPに戻る</Link><h1 style={{ fontSize: 23, borderLeft: "4px solid #c79a29", paddingLeft: 14 }}>ディーラーマッチング利用ガイド</h1>
  <p style={{ fontSize: 13, color: "#75644e" }}>店舗・ディーラー共通 ／ 2026年10月7日更新</p>
  {sections.map(section => <section className="card" key={section.title} style={{ marginTop: 16 }}><h2 style={{ fontSize: 17 }}>{section.title}</h2>{section.lines.map(line => <p key={line} style={{ lineHeight: 1.9, fontSize: 14 }}>{line}</p>)}</section>)}
  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "24px 0" }}><Link className="btn" href="/contact">運営に相談する</Link><Link className="btn" href="/terms">利用規約</Link><Link className="btn" href="/privacy">プライバシーポリシー</Link></div>
 </main><PortalFooter /><BottomTabs /></>;
}
