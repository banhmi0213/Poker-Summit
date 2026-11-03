'use client';
import {useEffect,useState} from 'react';
import type {FieldView} from '@/lib/poker/scheduled-tournament-room';
import {formatTableChips} from '@/app/poker-ui/table-preferences';
type Period={kind:string;minutes:number};
/** Seconds until late registration closes (end of level `lateRegLevel`), or null once closed. */
export function lateRegSeconds(periods:Period[],lateRegLevel:number,clock:{phase:string;index:number;level:number;remaining:number}):number|null{
 if(clock.phase==='final'||!periods.length)return null;
 if(clock.phase==='scheduled'){if(lateRegLevel<=0)return clock.remaining;let t=clock.remaining,level=0;for(const p of periods){t+=p.minutes*60;if(p.kind==='level'&&++level>=lateRegLevel)return t;}return null;}
 if(clock.level>lateRegLevel||(clock.level===lateRegLevel&&periods[clock.index]?.kind!=='level'))return null;
 let t=clock.remaining,level=clock.level;if(periods[clock.index]?.kind==='level'&&level>=lateRegLevel)return t;
 for(let i=clock.index+1;i<periods.length;i++){t+=periods[i].minutes*60;if(periods[i].kind==='level'&&++level>=lateRegLevel)return t;}
 return null;
}
const mmss=(n:number)=>`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;
const placeText=(place:number,through:number|null)=>through!==null&&through!==place?`${place}〜${through}位`:`${place}位`;
/** Owner 2026/10/31 (トナメは順位が一覧でわかるように): every entrant, best first — still in by chips, out by final place. */
export function FieldStandings({roomId,rows,bb,lateReg}:{roomId?:string;rows:FieldView['standings'];bb:number;/** Owner 2026/10/31 (レジクロ情報): late registration close; null once closed, undefined when unknown. */lateReg?:{level:number;seconds:number|null}}){
 const [names,setNames]=useState<Record<string,string>>({});
 useEffect(()=>{if(!roomId)return;let live=true;
  fetch(`/api/poker/tournament-entrants?room=${encodeURIComponent(roomId)}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(!live||!Array.isArray(d?.entrants))return;
   setNames(Object.fromEntries((d.entrants as {entry:string;displayName:string}[]).filter(e=>typeof e?.entry==='string'&&typeof e.displayName==='string').map(e=>[e.entry,e.displayName])));}).catch(()=>{});
  return()=>{live=false;};},[roomId]);
 if(!rows?.length)return null;
 const live=rows.filter(r=>r.stack!==null),total=live.reduce((a,r)=>a+(r.stack??0),0);
 return <div aria-label="順位一覧" style={{marginTop:8}}>
  <p style={{margin:'0 0 2px'}}>残り {live.length} / {rows.length}人{live.length?` · 平均 ${formatTableChips(Math.round(total/live.length),bb,false)}`:''}</p>
  {lateReg&&<p style={{margin:'0 0 6px'}}>レジクロ：{lateReg.seconds===null?'締切済み':`LEVEL ${lateReg.level}終了時（あと ${mmss(lateReg.seconds)}）`}</p>}
  <p style={{margin:'0 0 4px',fontWeight:700}}>順位一覧</p>
  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontVariantNumeric:'tabular-nums'}}>
   <thead><tr><th style={{textAlign:'left',padding:'2px 4px'}}>順位</th><th style={{textAlign:'left',padding:'2px 4px'}}>プレイヤー</th><th style={{textAlign:'right',padding:'2px 4px'}}>チップ</th></tr></thead>
   <tbody>{rows.map(r=><tr key={r.entry} aria-current={r.you||undefined} style={r.you?{background:'#f3c66333',fontWeight:700}:r.stack===null?{opacity:.7}:undefined}>
    <td style={{padding:'2px 4px',whiteSpace:'nowrap'}}>{r.place!==null?placeText(r.place,r.tiedThrough):'-'}</td>
    <td style={{padding:'2px 4px',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{names[r.entry]??`プレイヤー${r.entry.slice(2)}`}{r.you?'（あなた）':''}</td>
    <td style={{padding:'2px 4px',textAlign:'right',whiteSpace:'nowrap'}}>{r.stack!==null?formatTableChips(r.stack,bb,false):'敗退'}</td>
   </tr>)}</tbody>
  </table>
 </div>;
}
