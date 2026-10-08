import { ReadableName } from "@/app/readable-name";
import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {PortalHeader} from "@/app/portal-header";
import {PortalFooter} from "@/app/portal-footer";
import {BottomTabs} from "@/app/bottom-tabs";
export const dynamic="force-dynamic";
import type {Metadata} from "next";
import {SITE_NAME,absoluteUrl,clip,pageTitle} from "@/lib/seo";
import {JsonLd} from "@/lib/json-ld";
export async function generateMetadata({params}:{params:{id:string}}):Promise<Metadata>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id))return {};
 const db=await createClient();
 const {data:e}=await db.from("major_tournaments").select("id,title,location,venue,start_date,end_date,description").eq("id",params.id).eq("active",true).maybeSingle();
 if(!e)return {title:pageTitle("大会詳細・スケジュール")};
 const d=(v:string|null)=>v?v.replaceAll("-","/"):"";
 const period=d(e.start_date)+(e.end_date&&e.end_date!==e.start_date?"〜"+d(e.end_date):"");
 const place=[e.location,e.venue].filter(Boolean).join(" ");
 const title=pageTitle(`${e.title}${period?`（${period}）`:""} 日程・スケジュール`);
 const description=clip(`${e.title}の開催情報。${period?`日程：${period}。`:""}${place?`会場：${place}。`:""}${e.description??""}`,160);
 const path=`/major-tournaments/${e.id}`;
 return {title,description,alternates:{canonical:path},openGraph:{title,description,url:path,siteName:SITE_NAME,locale:"ja_JP",type:"website"},twitter:{card:"summary",title,description}};
}
function tournamentJsonLd(e:any){
 const data:Record<string,unknown>={"@context":"https://schema.org","@type":"Event",name:e.title,url:absoluteUrl(`/major-tournaments/${e.id}`),startDate:e.start_date,eventStatus:"https://schema.org/EventScheduled",eventAttendanceMode:"https://schema.org/OfflineEventAttendanceMode",location:{"@type":"Place",name:e.venue||e.location||"会場未定",address:e.location||e.venue||""}};
 if(e.end_date)data.endDate=e.end_date;
 if(e.description)data.description=clip(e.description,500);
 return data;
}
export default async function Page({params}:{params:{id:string}}){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id))notFound();
 const db=await createClient();
 const [{data:{user}},{data:e,error}]=await Promise.all([db.auth.getUser(),db.from("major_tournaments").select("*").eq("id",params.id).eq("active",true).maybeSingle()]);
 if(error)throw new Error("大会情報を読み込めませんでした。");
 if(!e)notFound();
 let officialUrl:string|null=null;
 try{const url=new URL(e.official_url);if(["https:","http:"].includes(url.protocol)&&!url.username&&!url.password)officialUrl=url.href;}catch{}
 const date=(value:string|null)=>value?value.replaceAll("-","/"):"未定";
 const period=date(e.start_date)+(e.end_date&&e.end_date!==e.start_date?" 〜 "+date(e.end_date):"");
 const mapQuery=[e.venue,e.location].filter(Boolean).join(" ");
 return <div>{e.start_date&&<JsonLd data={tournamentJsonLd(e)}/>}<PortalHeader userEmail={user?.email}/><main className="mt-sample">
 <Link href="/major-tournaments" className="mt-back">← 国内外大型大会に戻る</Link>
 <article><header className="mt-hero"><div className="mt-hero-photo" role="img" aria-label="ポーカー大会の会場"/>
 <div className="mt-hero-content"><div className="mt-eyebrow">POKER SUMMIT · MAJOR TOURNAMENTS</div><span className="mt-tag">{e.scope}大会</span><h1><ReadableName name={e.title} /></h1><div className="mt-hero-meta"><span>{period}</span>{mapQuery&&<span>{[e.location,e.venue].filter(Boolean).join(" / ")}</span>}</div></div></header>
 <div className="mt-facts"><div><small>開催期間</small><strong>{period}</strong></div><div><small>開催エリア</small><strong>{e.location||"未定"}</strong></div><div><small>会場</small><strong>{e.venue||"未定"}</strong></div><div><small>開催区分</small><strong>{e.scope}大会</strong></div></div>
 <nav className="mt-section-nav" aria-label="大会詳細のメニュー"><a href="#tournament-overview">大会概要</a><a href="#tournament-schedule">スケジュール</a><a href="#tournament-venue">会場・アクセス</a></nav>
 <div className="mt-columns"><div>
 <section id="tournament-overview" className="mt-panel"><div className="mt-heading"><span>ABOUT THE TOURNAMENT</span><h2>大会概要</h2></div><p className="mt-text">{e.description||"大会の詳細は準備中です。"}</p>{officialUrl&&<div className="mt-official-link"><strong>公式サイト</strong><a href={officialUrl} target="_blank" rel="noopener noreferrer">{officialUrl} ↗</a></div>}</section>
 <section id="tournament-schedule" className="mt-panel"><div className="mt-heading"><span>EVENT SCHEDULE</span><h2>大会スケジュール</h2></div><p className="mt-caption">時刻は開催地の現地時間です。</p><div className="mt-schedule-text">{e.schedule||"スケジュールは準備中です。"}</div></section>
 <section id="tournament-venue" className="mt-panel"><div className="mt-heading"><span>VENUE & ACCESS</span><h2>会場・アクセス</h2></div><div className="mt-venue"><div className="mt-venue-mark" aria-hidden="true">⌖</div><div><h3>{e.venue||"会場未定"}</h3>{e.location&&<p>{e.location}</p>}</div></div>
 {e.venue&&<a className="mt-map-link" href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(mapQuery)} target="_blank" rel="noopener noreferrer">Googleマップで会場を探す ↗</a>}</section>
 </div><aside className="mt-side"><section className="mt-panel mt-summary"><span className="mt-eyebrow">TOURNAMENT INFORMATION</span><h2>大会情報</h2>
 <dl><div><dt>開催区分</dt><dd>{e.scope}</dd></div><div><dt>開催地</dt><dd>{e.location||"未定"}</dd></div><div><dt>開催期間</dt><dd>{period}</dd></div><div><dt>会場</dt><dd>{e.venue||"未定"}</dd></div></dl>
 <a href="#tournament-schedule" className="mt-button">スケジュールを見る ↓</a>{officialUrl&&<a href={officialUrl} className="mt-button mt-official" target="_blank" rel="noopener noreferrer">公式サイト・大会情報 ↗</a>}</section>
 <section className="mt-panel mt-travel"><span className="mt-eyebrow">PLAN YOUR VISIT</span><h3>参加前にチェック</h3><ul><li>エントリー方法・受付時間</li><li>参加費に含まれる内容</li><li>本人確認・参加条件</li><li>大会ルール・持ち物</li></ul><p>最新の開催情報は、主催者の公式案内をご確認ください。</p></section></aside></div>
 <div className="mt-bottom"><Link href="/major-tournaments">← 国内外大型大会一覧へ</Link><Link href="/blog">大会レポート・BLOGを読む →</Link></div></article>
 </main><PortalFooter/><BottomTabs/><style>{`

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

.mt-hero h1{max-width:780px;overflow-wrap:anywhere}
.mt-facts strong{font-size:17px;line-height:1.6;overflow-wrap:anywhere}
.mt-text{white-space:pre-wrap;overflow-wrap:anywhere}
.mt-schedule-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:2;font-size:14px;background:#faf6ed;border:1px solid #e5d7bd;border-radius:9px;padding:22px;margin-top:18px}
.mt-summary dd{overflow-wrap:anywhere;max-width:65%}
.mt-map-link{display:inline-block;margin-top:20px;border:1px solid #dfcfaa;border-radius:7px;background:#faf6ed;padding:12px 16px;font-size:12px;color:#795a28}
.mt-official{background:#fff;color:#795a28;border-color:#d9c5a4}
@media(max-width:600px){.mt-hero h1{font-size:30px}.mt-facts strong{font-size:14px}.mt-schedule-text{font-size:13px;padding:16px}.mt-section-nav{flex-wrap:wrap}}

.mt-official-link{margin-top:22px;border-top:1px solid #e7dfd2;padding-top:18px;display:flex;flex-direction:column;gap:8px;font-size:13px}
.mt-official-link a{color:#8a6520;text-decoration:underline;overflow-wrap:anywhere}

.mt-hero{min-height:190px;background:linear-gradient(110deg,#cfad70,#e6cea2);border-radius:12px}
.mt-hero:after{display:none}
.mt-hero-photo{position:absolute;right:0;top:0;width:50%;height:100%;background:url('/images/major-tournament-banner.jpg') 99% 50% / 202% auto no-repeat}
.mt-hero-content{width:50%;box-sizing:border-box;padding:26px 30px;color:#563814}
.mt-hero .mt-eyebrow{color:#8b6427;font-size:9px;margin-bottom:10px}
.mt-tag{color:#755321;border-color:#b59050;background:rgba(255,255,255,.25);font-size:10px;padding:4px 10px}
.mt-hero h1{font-size:28px;line-height:1.35;margin:10px 0;color:#fff}
.mt-hero-meta{color:#563814;font-size:11px;line-height:1.7;gap:5px 16px;margin-top:12px}
@media(max-width:900px){.mt-hero h1{font-size:26px}}
@media(max-width:600px){.mt-hero{min-height:200px}.mt-hero-content{padding:20px 16px}.mt-hero h1{font-size:22px}.mt-hero .mt-eyebrow{font-size:7px;line-height:1.6}.mt-hero-photo{background-size:auto 155%;background-position:99% 50%}.mt-hero-meta{font-size:10px;gap:4px}}
`}</style></div>;
}
