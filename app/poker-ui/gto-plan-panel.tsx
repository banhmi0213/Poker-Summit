import Link from 'next/link';
import type {GtoPlanStatus} from '@/lib/billing/plan';
import {GTO_TIER_LABEL,PERIOD_LABEL,laterPrice,priceAt,yen} from '@/lib/billing/plans';
import {showPriceNotice} from '@/lib/billing/state';
import {PRO_ROADMAP} from '@/lib/billing/pro-roadmap';
/** プレイヤーページ「GTOプラン」 (2026/11/01): the member's plan, next charge or end date, and cancel with a confirmation step. */
const date=(iso:string|null)=>iso?new Date(iso).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const MESSAGES:Record<string,string>={trial:'カードの登録が完了し、無料お試しが始まりました。',cancelled:'カードの登録を中止しました。料金はかかっていません。',incomplete:'カードの登録が完了していません。もう一度お試しください。',
 canceled:'解約を受け付けました。',none:'解約できるプランはありません。',invalid:'手続きを確認できませんでした。',error:'処理できませんでした。時間をおいてお試しください。'};
export function GtoPlanPanel({status,message}:{status:GtoPlanStatus;message?:string}){
 const p=status.plan,open=p&&['trialing','active','past_due'].includes(p.status);
 return <div>
  {message&&MESSAGES[message]&&<p role="status">{MESSAGES[message]}</p>}
  <p>現在のプラン：<b>{GTO_TIER_LABEL[status.tier]}</b>{status.trial?'（無料お試し中）':''}</p>
  {status.active&&<p>{p?.cancelAtPeriodEnd||p?.status==='canceled'?'ご利用期限':status.trial?'お試し終了（最初のお支払い）':'次回のお支払い'}：{date(status.expiresAt)}</p>}
  {p&&open&&<p className="muted" style={{fontSize:13}}>{GTO_TIER_LABEL[p.tier]}・{PERIOD_LABEL[p.period]} {yen(p.amount??priceAt(p.tier,p.period,Date.now()))}（税込）</p>}
  {p&&open&&p.tier==='pro'&&showPriceNotice(Date.now())&&<section role="note" style={{margin:'10px 0',padding:'10px 12px',border:'1px solid #e0c68a',borderRadius:8,background:'#fff8e8',color:'#3b2e12',fontSize:13,lineHeight:1.8}}>
   <b>プロの料金改定のお知らせ</b>
   <p style={{margin:'4px 0'}}>スタート記念価格は2027年2月末で終了します。{p.period==='month'?`2027年3月1日以降の最初のお支払いから、月額${yen(laterPrice('pro','month'))}（税込）になります。`:`2027年3月1日以降の次回の更新から、年額${yen(laterPrice('pro','year'))}（税込）になります。お支払い済みの1年間はそのままです。`}</p>
   {PRO_ROADMAP.some(i=>i.done)&&<p style={{margin:'4px 0'}}>追加した内容：{PRO_ROADMAP.filter(i=>i.done).map(i=>i.label).join('／')}</p>}
   {PRO_ROADMAP.some(i=>!i.done)&&<p style={{margin:'4px 0'}}>これから追加する予定：{PRO_ROADMAP.filter(i=>!i.done).map(i=>i.label).join('／')}</p>}
   <p style={{margin:'4px 0'}}>新しい料金でのご利用を希望されない場合は、料金が変わる前に下の「解約する」から解約できます。お支払い済みの期間の終わりまではご利用いただけます。</p>
  </section>}
  {p?.status==='past_due'&&<p role="alert">お支払いができませんでした。カードの有効期限などをご確認ください。</p>}
  {!status.active&&<p><Link className="btn" href="/pricing">GTOプランを見る</Link></p>}
  {open&&<details style={{marginTop:12}}>
   <summary>解約する</summary>
   <p style={{fontSize:13,lineHeight:1.8}}>{p.status==='trialing'?'お試し期間中の解約のため、料金はかかりません。解約後は無料プランに戻ります。':`次回以降の自動のお支払いを停止します。${date(p.currentPeriodEnd)}まではご利用いただけます。日割りの返金はありません。`}</p>
   <form method="post" action="/api/billing/gto/cancel"><button className="btn" type="submit">解約を確定する</button></form>
  </details>}
  <p style={{fontSize:12,marginTop:12}}><Link href="/tokushoho#gto-plans">特定商取引法に基づく表記</Link> ／ <Link href="/terms#gto-plans">利用規約</Link></p>
 </div>;
}
