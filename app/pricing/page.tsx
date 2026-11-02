import Link from 'next/link';
import type {CSSProperties} from 'react';
import {PortalHeader} from '@/app/portal-header';
import {PortalFooter} from '@/app/portal-footer';
import {BottomTabs} from '@/app/bottom-tabs';
import {staticPageMetadata} from '@/lib/seo';
import {GTO_BILLING_FLAG,GTO_TRIAL_DAYS,PRO_CONSENT_LABEL,PRO_PRICE_LINES,currentPrices,proIsOpenPrice,yen,type BillingPeriod,type PaidTier} from '@/lib/billing/plans';
import {proRoadmapLine} from '@/lib/billing/pro-roadmap';
import {GTO_FEATURES_FINAL,GTO_PLAN_FEATURES} from '@/lib/billing/plan-features';
import {getGtoPlanStatus} from '@/lib/billing/plan';
export const dynamic='force-dynamic';
// DIRECT URL ONLY (owner 2026/11/01): kept reachable for the KOMOJU review, but noindex/nofollow, not in app/sitemap.ts,
// and not linked from anywhere while paid features are hidden (lib/billing/visibility.ts paidFeaturesVisible()).
export const metadata={...staticPageMetadata({title:'GTOプランの料金',description:'Poker SummitのGTOプラン（無料・スタンダード・プロ）の料金と内容。',path:'/pricing'}),robots:{index:false,follow:false}};
// GTO有料プランの料金ページ(2026/11/01)。販売開始(NEXT_PUBLIC_GTO_BILLING=on)までは「準備中」で、申込みボタンは押せない。
const TH:CSSProperties={padding:'10px 8px',textAlign:'center',borderBottom:'1px solid #ddd'};
const TD:CSSProperties={padding:'9px 8px',textAlign:'center',borderBottom:'1px solid #eee',fontSize:14};
const FAQ:{q:string;a:string}[]=[
 {q:'無料お試しはありますか？',a:`スタンダード・プロのどちらも、最初の${GTO_TRIAL_DAYS}日間は無料でお試しいただけます。お試し期間中に解約すれば、料金は一切かかりません。`},
 {q:'いつ料金がかかりますか？',a:`お試し期間（${GTO_TRIAL_DAYS}日間）が終わった時点で最初の料金をお支払いいただき、以後は月額または年額で自動更新されます。`},
 {q:'解約の方法は？',a:'プレイヤーページの「GTOプラン」から、いつでも解約できます。お試し期間中の解約は無料です。お支払い済みの期間が終わるまでは、そのままご利用いただけます。'},
 {q:'返金はできますか？',a:'デジタルサービスの性質上、お支払い後のお客様都合による返金は原則としてお受けしていません。二重請求や当社の不具合などの場合は、お問い合わせください。'},
 {q:'支払い方法は？',a:'クレジットカードのみです。カード情報は決済会社（KOMOJU）の画面で入力し、当サイトには保存しません。'},
 {q:'プロの料金は変わりますか？',a:'プロの月額1,980円・年額19,800円は、2027年2月末までのスタート記念価格です。2027年3月1日から月額2,980円・年額29,800円になります。月額の方は3月1日以降の最初のお支払いから、年額の方は次の更新から新しい料金です。料金が変わる前に、メールとプレイヤーページでお知らせします。スタンダードの料金は変わりません。'},
 {q:'チップやポイントはもらえますか？',a:'GTOプランは学習ツールのご利用料金です。チップ・ポイント等の付与や、現金・景品との交換はありません。'},
];
export default async function PricingPage({searchParams}:{searchParams:{period?:string;status?:string}}){
 const period:BillingPeriod=searchParams.period==='year'?'year':'month';
 const status=await getGtoPlanStatus();
 const open=GTO_BILLING_FLAG;
 const prices=currentPrices(),proOpen=proIsOpenPrice();
 const notice=searchParams.status==='price_ack'?`プロのお申込みには「${PRO_CONSENT_LABEL}」の確認が必要です。`:searchParams.status==='already'?'すでにGTOプランをご利用中です。':searchParams.status==='unavailable'?'GTOプランは準備中です。':searchParams.status==='error'||searchParams.status==='invalid'?'お申込みを開始できませんでした。時間をおいてお試しください。':null;
 const col=(tier:PaidTier,name:string)=>{
  const price=prices[tier][period],pro=tier==='pro'&&proOpen,lines=PRO_PRICE_LINES[period];
  return <div className="card" style={{textAlign:'center'}}>
   <h2 style={{fontSize:18,margin:'4px 0'}}>{name}</h2>
   <p style={{fontSize:24,fontWeight:800,margin:'6px 0'}}>{yen(price)}<small style={{fontSize:13,fontWeight:600}}>／{period==='month'?'月':'年'}（税込）{pro?'（スタート記念価格）':''}</small></p>
   {pro&&<div style={{textAlign:'left',fontSize:12,lineHeight:1.7,margin:'6px 0',padding:'8px 10px',border:'1px solid #e0c68a',borderRadius:8,background:'#fff8e8'}}><p style={{margin:'0 0 4px',fontWeight:700}}>{lines.head}</p><p style={{margin:'0 0 4px'}}>{lines.change}</p><p style={{margin:0}}>{proRoadmapLine()}</p></div>}
   {period==='year'&&<p className="muted" style={{fontSize:12}}>月あたり約{yen(Math.round(price/12))}</p>}
   <p style={{fontSize:13}}>最初の{GTO_TRIAL_DAYS}日間は無料</p>
   {open&&status.tier==='free'?<form method="post" action="/api/billing/gto/start"><input type="hidden" name="tier" value={tier}/><input type="hidden" name="period" value={period}/>{pro&&<label style={{display:'block',fontSize:12,margin:'6px 0 4px',lineHeight:1.6,fontWeight:700}}><input type="checkbox" name="price_ack" value="on" required/> {PRO_CONSENT_LABEL}</label>}<label style={{display:'block',fontSize:12,margin:'6px 0 10px',lineHeight:1.6}}><input type="checkbox" name="agree" value="on" required/> <Link href="/terms#gto-plans">利用規約（第19条の2）</Link>と<Link href="/tokushoho#gto-plans">特定商取引法に基づく表記</Link>を確認し、同意します</label><button className="btn" type="submit">{GTO_TRIAL_DAYS}日間無料で試す</button></form>
    :<button className="btn" type="button" disabled>{open?'ご利用中のプランがあります':'準備中'}</button>}
  </div>;
 };
 return <div><PortalHeader/>
  <div className="container" style={{maxWidth:820}}>
   <h1 style={{fontSize:22,marginBottom:8}}>GTOプランの料金</h1>
   <p style={{lineHeight:1.8}}>GTO（ゲーム理論にもとづく正解の打ち方）の表・練習・ハンドの判定を、もっと使える有料プランです。{open?'':'現在準備中のため、お申込みはまだできません。'}</p>
   {notice&&<p role="status" className="card">{notice}</p>}
   <nav aria-label="支払いの周期" style={{display:'flex',gap:8,margin:'14px 0'}}>
    <Link className="btn" aria-current={period==='month'?'page':undefined} href="/pricing?period=month" style={period==='month'?{}:{opacity:.6}}>月額</Link>
    <Link className="btn" aria-current={period==='year'?'page':undefined} href="/pricing?period=year" style={period==='year'?{}:{opacity:.6}}>年額（約2か月分お得）</Link>
   </nav>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
    <div className="card" style={{textAlign:'center'}}><h2 style={{fontSize:18,margin:'4px 0'}}>無料</h2><p style={{fontSize:24,fontWeight:800,margin:'6px 0'}}>0円</p><p style={{fontSize:13}}>会員登録だけで使えます</p></div>
    {col('standard','スタンダード')}{col('pro','プロ')}
   </div>
   <h2 style={{fontSize:18,marginTop:24}}>プランの比較</h2>
   {!GTO_FEATURES_FINAL&&<p className="muted" style={{fontSize:12}}>※内容は準備中のため、変更になる場合があります。</p>}
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:480}}>
    <thead><tr><th style={{...TH,textAlign:'left'}}>機能</th><th style={TH}>無料</th><th style={TH}>スタンダード</th><th style={TH}>プロ</th></tr></thead>
    <tbody>{GTO_PLAN_FEATURES.map(r=><tr key={r.label}><td style={{...TD,textAlign:'left'}}>{r.label}</td><td style={TD}>{r.free}</td><td style={TD}>{r.standard}</td><td style={TD}>{r.pro}</td></tr>)}</tbody>
   </table></div>
   <h2 style={{fontSize:18,marginTop:24}}>よくあるご質問</h2>
   <div className="card">{FAQ.map(f=><div key={f.q} style={{marginBottom:14}}><h3 style={{fontSize:15,margin:'0 0 4px'}}>{f.q}</h3><p style={{lineHeight:1.8,margin:0}}>{f.a}</p></div>)}</div>
   <p style={{fontSize:13,lineHeight:1.8,marginTop:16}}>料金・自動更新・解約の条件は、<Link href="/tokushoho#gto-plans">特定商取引法に基づく表記</Link>および<Link href="/terms#gto-plans">利用規約</Link>をご確認ください。</p>
  </div>
  <PortalFooter/><BottomTabs/>
 </div>;
}
