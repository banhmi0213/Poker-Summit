'use client';
import {useState} from 'react';
import {GTO_TOOLS,TOOL_IDS,type GtoTool} from '@/lib/gto-usage';
const COLORS=['#be8a2e','#2563eb','#dc2626','#9333ea','#059669','#d97706','#475569','#db2777','#0891b2','#65a30d'];
export function UsageTrend({points,monthly,startedAt}:{points:{date:string;values:Record<GtoTool,number>}[];monthly:boolean;startedAt?:string}){
 const [selected,setSelected]=useState<GtoTool[]>([...TOOL_IDS]);
 const since=startedAt?new Date(Date.parse(startedAt)+9*3600000).toISOString().slice(0,10):null;
 const available=(date:string)=>!!since&&(monthly?date.slice(0,7)>=since.slice(0,7):date>=since);
 const max=Math.max(1,...points.flatMap(p=>selected.map(t=>p.values[t]))),W=900,H=250,L=45,R=15,T=15,B=36;
 const x=(i:number)=>L+i*(W-L-R)/Math.max(1,points.length-1),y=(v:number)=>H-B-v*(H-T-B)/max;
 return <div className="card" style={{marginBottom:14}}><h2 style={{fontSize:16,marginTop:0}}>利用人数の推移（直近{monthly?'12か月':'30日'}）</h2>
  <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:12.5,marginBottom:12}}>{TOOL_IDS.map((t,i)=><label key={t} style={{color:COLORS[i],display:'flex',gap:4,alignItems:'center'}}><input type="checkbox" checked={selected.includes(t)} onChange={()=>setSelected(s=>s.includes(t)?s.filter(v=>v!==t):[...s,t])}/>{GTO_TOOLS[t]}</label>)}</div>
  <div style={{overflowX:'auto'}}><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="道具ごとの利用人数の推移。各線の点にカーソルを合わせると人数が分かります。" style={{width:'100%',minWidth:600}}>
   {[0,1,2,3,4].map(i=>{const value=max*i/4;return <g key={i}><line x1={L} x2={W-R} y1={y(value)} y2={y(value)} stroke="var(--border)"/><text x={L-8} y={y(value)+4} textAnchor="end" fontSize="11" fill="currentColor">{Number(value.toFixed(1))}</text></g>;})}
   {points.map((p,i)=>i===0||i===points.length-1||i%(monthly?2:5)===0?<text key={p.date} x={x(i)} y={H-12} textAnchor="middle" fontSize="11" fill="currentColor">{monthly?p.date.slice(0,7):p.date.slice(5).replace('-','/')}</text>:null)}
   {TOOL_IDS.map((t,ti)=>selected.includes(t)?<g key={t}><polyline fill="none" stroke={COLORS[ti]} strokeWidth="2" points={points.map((p,i)=>available(p.date)?`${x(i)},${y(p.values[t])}`:'').filter(Boolean).join(' ')}/>{points.map((p,i)=>available(p.date)?<circle key={p.date} cx={x(i)} cy={y(p.values[t])} r="3" fill={COLORS[ti]}><title>{p.date} {GTO_TOOLS[t]}：{p.values[t]}人</title></circle>:null)}</g>:null)}
  </svg></div><p className="muted" style={{fontSize:12}}>集計開始前の期間は未計測のため、線を表示しません。</p><details><summary style={{fontSize:12}}>人数を表で確認</summary><div style={{overflowX:'auto'}}><table style={{fontSize:12,width:'100%'}}><thead><tr><th>期間</th>{selected.map(t=><th key={t}>{GTO_TOOLS[t]}</th>)}</tr></thead><tbody>{points.map(p=><tr key={p.date}><td>{monthly?p.date.slice(0,7):p.date}</td>{selected.map(t=><td key={t}>{available(p.date)?p.values[t]:'—'}</td>)}</tr>)}</tbody></table></div></details>
 </div>;
}
