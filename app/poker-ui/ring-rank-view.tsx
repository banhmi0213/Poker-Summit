'use client';
// Player page: your ring rank, lifetime BB and where you stand among everyone (owner 2026/11/01: 全体のランキングは
// 自分のマイページにだけ。自分がどの位置か分かるように). Nobody else's name or numbers are shown.
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {parseRingRank,tierName,RING_TIER_EN,type RingRank} from '@/lib/poker/ring-rank';
import {RingBbCurve} from './ring-bb-curve';

const STEPS=[{tier:2,at:100},{tier:3,at:300},{tier:4,at:1000},{tier:5,at:3000},{tier:6,at:6000}];
const bb=(n:number)=>`${n>0?'+':''}${n.toLocaleString('ja-JP',{maximumFractionDigits:1})} BB`;

export function RingRankView(){
 const auth=useMemo(()=>createClient(),[]);
 const [rank,setRank]=useState<RingRank|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let live=true;void auth.rpc('poker_ring_rank').then(({data,error})=>{if(!live)return;if(error){setFailed(true);return;}setRank(parseRingRank(data));});return()=>{live=false;};},[auth]);
 if(failed)return <p>段位を読み込めませんでした。<a href="/login">ログイン状態</a>をご確認ください。</p>;
 if(!rank)return <p role="status">段位を確認しています…</p>;
 const progress=rank.tier===0?Math.min(1,(100-rank.rookieHandsLeft)/100):rank.next===null?1:rank.floor===null?Math.max(0,Math.min(1,rank.bb/rank.next)):Math.max(0,Math.min(1,(rank.bb-rank.floor)/(rank.next-rank.floor)));
 return <div style={{display:'grid',gap:16}}>
  <section style={{padding:'18px 20px',border:'1px solid #c7ac75',borderRadius:14,background:'#10233c',color:'#f3ead6'}}>
   <small style={{letterSpacing:'.16em',color:'#c7ac75'}}>{RING_TIER_EN[rank.tier]}</small>
   <h3 style={{margin:'4px 0 8px',fontSize:26}}>{tierName(rank.tier)}</h3>
   <p style={{margin:0}}>リング通算 <strong>{bb(rank.bb)}</strong>（{rank.hands.toLocaleString()}ハンド）</p>
   <div aria-hidden="true" style={{height:10,borderRadius:5,background:'#203a4c',margin:'14px 0 6px',overflow:'hidden'}}><div style={{width:`${Math.round(progress*100)}%`,height:'100%',background:'#c7ac75'}}/></div>
   <p style={{margin:0,fontSize:13}}>{rank.tier===0?`あと${rank.rookieHandsLeft}ハンドでブロンズ以上の段位がつきます。`:rank.next===null?'最高の段位です。':`次の${tierName(rank.tier+1)}まで あと ${Math.max(0,rank.next-rank.bb).toLocaleString('ja-JP',{maximumFractionDigits:1})} BB`}{rank.floor!==null&&` ・ ${rank.floor.toLocaleString()} BBを下回ると${tierName(rank.tier-1)}に下がります`}</p>
  </section>
  <RingBbCurve/>
  <section><h3 style={{margin:'0 0 6px'}}>全体の中の位置</h3><p style={{margin:0}}>{rank.place===null?'リングで1ハンド打つと順位がつきます。':<>リング通算BBで <strong>{rank.place.toLocaleString()}位</strong>（{rank.players.toLocaleString()}人中）</>}</p><p style={{fontSize:12,margin:'6px 0 0'}}>全体の順位は自分にだけ表示されます。</p></section>
  <section><h3 style={{margin:'0 0 6px'}}>段位の決まり方</h3>
   <ul style={{margin:0,paddingLeft:'1.2em',fontSize:13,lineHeight:1.9}}>
    <li>リングゲームの勝ち負けを、その卓のBBで数えた通算（レーキを引いた後）で決まります。大会のハンドは数えません。</li>
    <li>リングで100ハンドまではルーキー。そのあと：ブロンズ（〜99BB）{STEPS.map(s=>`・${tierName(s.tier)}（${s.at.toLocaleString()}BB〜）`).join('')}</li>
    <li>下限を下回ると、その場で1つ下がります。</li>
    <li>プラチナ以上：毎月のチップのリセットと無料補充が3,000 chipになります。5/10・10/20の卓に座れ、1/2の卓には座れません。2/5で勝った分は半分だけ数えます。</li>
    <li>区切りの数字は、遊ばれ方を見て調整することがあります。</li>
   </ul></section>
 </div>;
}
