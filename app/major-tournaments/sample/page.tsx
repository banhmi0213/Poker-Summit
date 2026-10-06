import Link from "next/link";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

export const metadata = { title: "大型大会 詳細ページサンプル | Poker Summit", robots: { index: false, follow: false } };

const days = [
 {date:"11/20",weekday:"金",label:"開幕・Day 1A",events:[
  {time:"12:00",name:"Main Event — Day 1A",fee:"¥50,000",stack:"50,000",close:"18:30",tag:"MAIN"},
  {time:"16:00",name:"Welcome NLH",fee:"¥15,000",stack:"30,000",close:"19:00",tag:"SIDE"},
  {time:"19:00",name:"Main Event Satellite",fee:"¥8,000",stack:"20,000",close:"21:00",tag:"SATELLITE"}]},
 {date:"11/21",weekday:"土",label:"Day 1B・ハイローラー",events:[
  {time:"12:00",name:"Main Event — Day 1B",fee:"¥50,000",stack:"50,000",close:"18:30",tag:"MAIN"},
  {time:"15:00",name:"High Roller",fee:"¥150,000",stack:"100,000",close:"20:00",tag:"HIGH ROLLER"},
  {time:"18:00",name:"Mystery Bounty — Day 1",fee:"¥30,000",stack:"40,000",close:"22:00",tag:"SIDE"}]},
 {date:"11/22",weekday:"日",label:"決勝・ファイナル",events:[
  {time:"12:00",name:"Main Event — Final Day",fee:"進出者のみ",stack:"持ち越し",close:"—",tag:"FINAL"},
  {time:"13:00",name:"Mystery Bounty — Final Day",fee:"進出者のみ",stack:"持ち越し",close:"—",tag:"FINAL"},
  {time:"16:00",name:"Last Chance Turbo",fee:"¥12,000",stack:"25,000",close:"18:00",tag:"SIDE"}]}
];

export default function TournamentSample() {
 return <div><PortalHeader/>
 <main className="mt-sample">
  <Link href="/major-tournaments" className="mt-back">← 国内外大型大会に戻る</Link>
  <div className="mt-note"><strong>詳細ページのデザインサンプル</strong><span>大会名・日程・参加費・会場はすべて架空の表示例です。</span></div>
  <article>
   <header className="mt-hero">
    <img src="/images/poker-store-finder-banner.jpg" alt="" className="mt-hero-image"/>
    <div className="mt-hero-content">
     <div className="mt-eyebrow">POKER SUMMIT · MAJOR TOURNAMENTS</div>
     <span className="mt-tag">国内大会 · SAMPLE</span>
     <h1>JAPAN POKER<br/>FESTIVAL <span>2026</span></h1>
     <p>ポーカーを楽しむ、特別な３日間。</p>
     <div className="mt-hero-meta"><span>2026.11.20 FRI — 11.22 SUN</span><span>日本・東京 / サンプルホール</span></div>
    </div>
   </header>
   <div className="mt-facts">
    <div><small>開催期間</small><strong>11月20日 — 22日</strong><span>３日間開催</span></div>
    <div><small>メイン参加費</small><strong>¥50,000</strong><span>表示例</span></div>
    <div><small>スタートスタック</small><strong>50,000</strong><span>Main Event</span></div>
    <div><small>開催エリア</small><strong>東京・日本</strong><span>国内大会</span></div>
   </div>
   <nav className="mt-section-nav" aria-label="大会詳細のメニュー"><a href="#sample-overview">大会概要</a><a href="#sample-schedule">スケジュール</a><a href="#sample-venue">会場・アクセス</a></nav>
   <div className="mt-columns">
    <div>
     <section id="sample-overview" className="mt-panel">
      <div className="mt-heading"><span>ABOUT THE FESTIVAL</span><h2>大会概要</h2></div>
      <p className="mt-lead">初めての大型大会から、次のタイトルを狙うプレイヤーまで。</p>
      <p>メインイベントを中心に、ハイローラー、ミステリーバウンティ、サテライトなどを楽しめる３日間の大会を想定したページです。</p>
      <p>大会の特徴や参加方法、賞品、エントリー条件などをここに掲載できます。</p>
      <div className="mt-callout"><strong>メインイベントの流れ</strong><p>Day 1A または Day 1B に参加 → 通過者は11/22のFinal Dayへ</p></div>
     </section>
     <section id="sample-schedule" className="mt-panel">
      <div className="mt-heading"><span>EVENT SCHEDULE</span><h2>大会スケジュール</h2></div>
      <p className="mt-caption">時刻は開催地の現地時間です。このサンプルは日本時間（JST / UTC+9）。</p>
      <nav className="mt-days" aria-label="開催日を選ぶ">{days.map((day,i)=><a key={day.date} href={`#sample-day-${i}`}><strong>{day.date}<small>（{day.weekday}）</small></strong><span>{day.label}</span></a>)}</nav>
      {days.map((day,i)=><div className="mt-day" id={`sample-day-${i}`} key={day.date}>
       <h3>{day.date}<span>（{day.weekday}）</span><small>{day.label}</small></h3>
       <div className="mt-table-wrap"><table><caption className="mt-sr">{day.date}の大会スケジュール</caption><thead><tr><th scope="col">開始</th><th scope="col">イベント</th><th scope="col">参加費</th><th scope="col">スタック</th><th scope="col">受付締切</th></tr></thead><tbody>{day.events.map(e=><tr key={e.name}><td data-label="開始" className="mt-time">{e.time}</td><td data-label="イベント" className="mt-event"><span className={`mt-event-tag ${e.tag==="MAIN"?"mt-main-tag":""}`}>{e.tag}</span><strong>{e.name}</strong></td><td data-label="参加費">{e.fee}</td><td data-label="スタック">{e.stack}</td><td data-label="受付締切">{e.close}</td></tr>)}</tbody></table></div>
      </div>)}
      <p className="mt-caption">参加費・開始時刻・受付締切などは、大会ごとの公式情報に合わせて記載します。</p>
     </section>
     <section id="sample-venue" className="mt-panel">
      <div className="mt-heading"><span>VENUE & ACCESS</span><h2>会場・アクセス</h2></div>
      <div className="mt-venue"><div className="mt-venue-mark" aria-hidden="true">⌖</div><div><h3>サンプルホール 東京</h3><p>日本・東京都（会場の表示例）</p><p className="mt-caption">ここに住所、最寄り駅、駅からの徒歩時間を掲載します。</p></div></div>
      <div className="mt-map-placeholder"><span aria-hidden="true">⌖</span><strong>会場の地図</strong><small>本番では登録した会場のGoogleマップを表示</small></div>
     </section>
    </div>
    <aside className="mt-side">
     <section className="mt-panel mt-summary">
      <span className="mt-eyebrow">TOURNAMENT INFORMATION</span><h2>大会情報</h2>
      <dl><div><dt>開催区分</dt><dd>国内</dd></div><div><dt>開催地</dt><dd>日本・東京</dd></div><div><dt>開催期間</dt><dd>2026/11/20〜11/22</dd></div><div><dt>会場</dt><dd>サンプルホール 東京</dd></div><div><dt>主催</dt><dd>サンプル大会事務局</dd></div></dl>
      <a href="#sample-schedule" className="mt-button">スケジュールを見る ↓</a>
      <button disabled className="mt-button mt-outline">公式サイト・エントリー ↗</button><small className="mt-caption">サンプルのため公式リンクはありません。</small>
     </section>
     <section className="mt-panel mt-travel"><span className="mt-eyebrow">PLAN YOUR VISIT</span><h3>参加前にチェック</h3><ul><li>エントリー方法・受付時間</li><li>参加費に含まれる内容</li><li>本人確認・参加条件</li><li>大会ルール・持ち物</li></ul><p>公式サイトの案内を確認して、当日は余裕をもって会場へ。</p></section>
    </aside>
   </div>
   <div className="mt-bottom"><Link href="/major-tournaments">← 国内外大型大会一覧へ</Link><Link href="/blog">大会レポート・BLOGを読む →</Link></div>
  </article>
 </main><PortalFooter/><BottomTabs/>
 <style>{`
.mt-sample{max-width:1140px;width:calc(100% - 40px);margin:0 auto;padding:24px 0 48px;color:#382b1e}
.mt-back{font-size:13px;color:#785622;display:inline-block;margin-bottom:18px}
.mt-note{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:12px;padding:12px 16px;border:1px solid #dfc995;background:#fff9e9;border-radius:9px;margin-bottom:18px;color:#745627}
.mt-hero{min-height:330px;position:relative;border-radius:16px;overflow:hidden;background:#292820;display:flex;align-items:center}
.mt-hero-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:right center}
.mt-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(28,26,21,.96),rgba(28,26,21,.7) 48%,rgba(28,26,21,.1))}
.mt-hero-content{position:relative;z-index:1;padding:36px 40px;color:#fff;width:100%}
.mt-eyebrow{font-size:10px;letter-spacing:.18em;color:#9b772e;display:block}
.mt-hero .mt-eyebrow{color:#e3c17c;margin-bottom:18px}
.mt-tag{display:inline-block;font-size:11px;border:1px solid #bda16a;color:#f1dab0;border-radius:30px;padding:5px 12px}
.mt-hero h1{font-size:42px;line-height:1.14;letter-spacing:.02em;margin:14px 0 10px;font-family:Georgia,serif;color:#fff;border:0;padding:0}
.mt-hero h1 span{color:#e5c487}
.mt-hero-content>p{font-size:14px;color:#f1e7d3}
.mt-hero-meta{display:flex;flex-wrap:wrap;gap:12px 24px;font-size:12px;color:#f0debb;margin-top:25px}
.mt-facts{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #e7ddcc;border-radius:12px;background:#fff;margin:18px 0}
.mt-facts>div{padding:20px 22px;border-right:1px solid #eee6da;display:flex;flex-direction:column;gap:6px}.mt-facts>div:last-child{border:0}
.mt-facts small{color:#8a775b;font-size:11px}.mt-facts strong{font-size:20px;color:#594220}.mt-facts span{font-size:11px;color:#9a8a73}
.mt-section-nav{display:flex;gap:26px;border-bottom:1px solid #dfd5c5;margin:20px 0 24px;padding:0 4px 13px;font-size:13px;font-weight:700}.mt-section-nav a{color:#755525}
.mt-columns{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:22px;align-items:start}
.mt-panel{border:1px solid #e7dfd2;border-radius:12px;background:#fff;padding:25px;margin-bottom:22px;scroll-margin-top:180px}
.mt-heading{margin-bottom:20px}.mt-heading>span{font-size:9px;letter-spacing:.18em;color:#a78237}.mt-heading h2{font-size:22px;margin:5px 0 0;line-height:1.4;color:#382b1e}
.mt-panel>p{line-height:1.9;font-size:13px}.mt-lead{font-weight:700;font-size:15px!important}
.mt-callout{background:#faf5e9;border-left:3px solid #c6a34e;padding:15px 18px;margin-top:20px;font-size:13px}.mt-callout p{margin:6px 0 0;line-height:1.7}
.mt-caption{font-size:11px!important;line-height:1.7;color:#8c7c67;display:block}
.mt-days{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:20px 0 24px}
.mt-days a{background:#faf6ed;border:1px solid #dfcfaa;border-radius:9px;padding:13px 9px;text-align:center;color:#664d26}.mt-days a:hover{background:#f3e7c7}
.mt-days strong{font-size:20px;display:block}.mt-days small{font-size:10px}.mt-days span{font-size:10px;display:block;margin-top:5px}
.mt-day{margin-bottom:28px;scroll-margin-top:180px}.mt-day h3{font-size:22px;border-bottom:2px solid #c4a254;padding-bottom:10px;margin:0 0 12px}.mt-day h3>span{font-size:12px}.mt-day h3>small{font-size:11px;color:#8c7c67;margin-left:12px;font-weight:400}
.mt-table-wrap{width:100%}.mt-sample table{width:100%;border-collapse:collapse;font-size:11px}.mt-sample th{text-align:left;background:#f8f5ee;padding:10px 8px;color:#847359;font-weight:500;white-space:nowrap}.mt-sample td{border-bottom:1px solid #eee7dc;padding:14px 8px;vertical-align:middle}
.mt-time{font-size:14px;font-weight:700;color:#604925}.mt-event strong{display:block;font-size:12px;line-height:1.6}
.mt-event-tag{font-size:8px;letter-spacing:.06em;display:inline-block;border-radius:3px;background:#f1eee8;padding:2px 5px;color:#85765e;margin-bottom:4px}.mt-main-tag{background:#f4e5bc;color:#936b21}
.mt-summary{background:#fcfaf6}.mt-summary h2{font-size:20px;margin:10px 0 16px}.mt-summary dl{margin:0 0 20px}.mt-summary dl>div{display:flex;justify-content:space-between;gap:15px;border-bottom:1px solid #eae1d2;padding:12px 0;font-size:11px}.mt-summary dt{color:#8a775b}.mt-summary dd{margin:0;text-align:right}
.mt-button{display:block;width:100%;box-sizing:border-box;text-align:center;background:#cca637;border:1px solid #cca637;color:#30220d;border-radius:7px;padding:12px 10px;font-size:12px;font-weight:700;margin:10px 0}
.mt-outline{background:#fff;border-color:#ddd0b8;color:#9b8a6c;cursor:default}
.mt-travel{background:#faf6ed}.mt-travel h3{font-size:17px;margin:10px 0}.mt-travel ul{padding-left:18px;font-size:12px;line-height:2}.mt-travel p{font-size:11px;line-height:1.8;color:#8b775b}
.mt-venue{display:flex;gap:15px;align-items:center}.mt-venue-mark{font-size:32px;color:#b88e31}.mt-venue h3{font-size:17px;margin:0 0 8px}.mt-venue p{font-size:12px;margin:6px 0}
.mt-map-placeholder{background:repeating-linear-gradient(25deg,#f6f2e9,#f6f2e9 28px,#eeeadf 29px,#eeeadf 30px);border:1px solid #e5ded1;border-radius:9px;min-height:160px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;margin-top:18px;color:#8b7654}.mt-map-placeholder>span{font-size:32px}.mt-map-placeholder strong{font-size:14px}.mt-map-placeholder small{font-size:10px}
.mt-bottom{display:flex;justify-content:space-between;gap:20px;border-top:1px solid #e7dfd2;padding-top:20px;font-size:12px;color:#795a28}
.mt-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:900px){.mt-columns{grid-template-columns:1fr}.mt-side{display:grid;grid-template-columns:1fr 1fr;gap:18px}.mt-hero h1{font-size:36px}.mt-facts strong{font-size:18px}}
@media(max-width:600px){.mt-sample{width:calc(100% - 24px);padding-top:18px}.mt-hero{min-height:310px}.mt-hero-content{padding:26px 22px}.mt-hero h1{font-size:32px}.mt-hero:after{background:linear-gradient(90deg,rgba(28,26,21,.94),rgba(28,26,21,.65))}.mt-hero-meta{flex-direction:column;gap:8px}.mt-facts{grid-template-columns:repeat(2,1fr)}.mt-facts>div{padding:16px}.mt-facts>div:nth-child(2){border-right:0}.mt-facts>div:nth-child(-n+2){border-bottom:1px solid #eee6da}.mt-facts strong{font-size:17px}.mt-panel{padding:20px 16px}.mt-section-nav{gap:18px;font-size:12px}.mt-side{display:block}.mt-days span{font-size:9px}.mt-sample table,.mt-sample tbody,.mt-sample tr,.mt-sample td{display:block}.mt-sample thead{display:none}.mt-sample tr{padding:14px 12px;margin-bottom:10px;border:1px solid #e8dfd0;border-radius:9px}.mt-sample td{padding:5px 0;border:0;display:flex;align-items:center;justify-content:space-between;gap:12px}.mt-sample td:before{content:attr(data-label);font-size:11px;font-weight:400;color:#8c7c67}.mt-sample .mt-event{display:block;padding:8px 0}.mt-sample .mt-event:before{display:none}.mt-event strong{font-size:14px}.mt-time{font-size:18px}.mt-bottom{flex-direction:column}.mt-note{font-size:11px}}
`}</style></div>;
}
