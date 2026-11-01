'use client';
// 収支グラフ (owner 2026/11/01): your lifetime ring result in BB, hand by hand. Only your own numbers.
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '@/lib/supabase/client';

// [hand number, total BB, time, total EV loss vs GTO in BB (from the 弱点分析 records; 0 when none)]
type Point=[number,number,string,number];
export function RingBbCurve(){
 const auth=useMemo(()=>createClient(),[]);
 const [points,setPoints]=useState<Point[]|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let live=true;void auth.rpc('poker_ring_bb_curve').then(({data,error})=>{if(!live)return;if(error||!Array.isArray(data)){setFailed(true);return;}
  setPoints((data as unknown[]).filter((p):p is Point=>Array.isArray(p)&&typeof p[0]==='number').map(p=>[p[0],Number(p[1]),String(p[2]),Number(p[3])||0]));});return()=>{live=false;};},[auth]);
 if(failed)return null;
 if(!points)return <p role="status">収支グラフを読み込んでいます…</p>;
 if(points.length<2)return <p>リングで2ハンド以上打つと、収支グラフが表示されます。</p>;
 const W=640,H=220,P=36,last=points[points.length-1],xs=points.map(p=>p[0]),ev=last[3]>0.05,ys=points.flatMap(p=>ev?[p[1],p[1]+p[3]]:[p[1]]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(0,...ys),maxY=Math.max(0,...ys),spanY=maxY-minY||1,spanX=maxX-minX||1;
 const x=(n:number)=>P+(n-minX)/spanX*(W-P*1.5),y=(v:number)=>H-P/1.5-(v-minY)/spanY*(H-P*1.4);
 const path=points.map((p,i)=>`${i?'L':'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
 // GTOどおりなら (a guide): the actual result plus what the graded decisions lost against GTO up to that hand.
 const gto=ev?points.map((p,i)=>`${i?'L':'M'}${x(p[0]).toFixed(1)},${y(p[1]+p[3]).toFixed(1)}`).join(' '):'';
 const fmt=(v:number)=>`${v>0?'+':''}${v.toLocaleString('ja-JP',{maximumFractionDigits:1})}`;
 return <figure style={{margin:0}}>
  <figcaption style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:6}}><strong>収支グラフ（リング・BB）</strong><span>{last[0].toLocaleString()}ハンド ・ 通算 <b style={{color:last[1]>=0?'#2f7d4f':'#b04646'}}>{fmt(last[1])} BB</b></span></figcaption>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`リングの通算収支 ${fmt(last[1])}BB（${last[0]}ハンド）`} style={{width:'100%',height:'auto',background:'#fff',border:'1px solid #e1d8c6',borderRadius:12}}>
   <line x1={P} x2={W-P/2} y1={y(0)} y2={y(0)} stroke="#c9ced6" strokeDasharray="4 4"/>
   <text x={P-6} y={y(maxY)+4} textAnchor="end" fontSize="11" fill="#687787">{fmt(maxY)}</text>
   <text x={P-6} y={y(0)+4} textAnchor="end" fontSize="11" fill="#687787">0</text>
   {minY<0&&<text x={P-6} y={y(minY)+4} textAnchor="end" fontSize="11" fill="#687787">{fmt(minY)}</text>}
   <text x={x(maxX)} y={H-6} textAnchor="end" fontSize="11" fill="#687787">{maxX.toLocaleString()}ハンド</text>
   {ev&&<path d={gto} fill="none" stroke="#c9a04e" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round"/>}
   <path d={path} fill="none" stroke="#203a4c" strokeWidth="2" strokeLinejoin="round"/>
   <circle cx={x(last[0])} cy={y(last[1])} r="4" fill={last[1]>=0?'#2f7d4f':'#b04646'}/>
  </svg>
  {ev&&<p style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'4px 14px',fontSize:13,margin:'8px 0 0'}}>
   <span><i aria-hidden="true" style={{display:'inline-block',width:18,borderTop:'2px solid #203a4c',verticalAlign:'middle',marginRight:5}}/>実際の収支</span>
   <span><i aria-hidden="true" style={{display:'inline-block',width:18,borderTop:'2px dashed #c9a04e',verticalAlign:'middle',marginRight:5}}/>GTOどおりなら（目安）</span></p>}
  {ev&&<p style={{fontSize:14,margin:'6px 0 0'}}>GTOと違う打ち方で、合わせて <b>{last[3].toLocaleString('ja-JP',{maximumFractionDigits:1})} BB</b> 損した計算です。<a href="/mypage/poker?pane=weak" style={{fontWeight:700}}>弱点分析を見る</a></p>}
  <p style={{fontSize:12,margin:'6px 0 0'}}>レーキを引いた後の勝ち負けを、その卓のBBで数えています。大会のハンドは入りません。{ev&&'点線は、GTOと比べられた判断の損（EV損失）を足し戻した目安です。'}</p>
 </figure>;
}
