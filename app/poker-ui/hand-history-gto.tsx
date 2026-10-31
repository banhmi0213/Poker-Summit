'use client';
import {useEffect,useMemo,useState} from 'react';
import styles from './hand-history.module.css';
import {HandHistoryList,type HandGtoMark} from './hand-history-list';
import type {HandHistoryView} from '@/lib/poker/hand-histories';
import type {GtoReviewHand,HandFlags} from '@/lib/poker/gto-review';
import type {GtoReply,GtoRequest} from '@/lib/poker/gto.worker';
import {RING_RAKE} from '@/lib/poker/ring-rake';

/** Hand list with automatic GTO marks (2026/10/30, Olympia の「!」と「GTO乖離」絞り込みに合わせて): every listed hand is
 * judged in the GTO worker — preflop and flop at once, then turn and river one hand at a time — and hands with a
 * decision GTO makes under 5% get a 「!」. Filters: all / off before the flop / off after the flop. */
export function toReviewHand(h:HandHistoryView):GtoReviewHand{
 return {handId:h.handId,terms:h.terms,buttonSeatId:h.buttonSeatId,board:h.board,actions:h.actions,...(h.kind==='ring'?{rake:RING_RAKE}:{}),
  players:h.players.map(p=>({seatId:p.seatId,seat:p.seat,startStack:p.startStack,you:p.you,hole:p.you?p.hole:null}))};
}
const STREET:Record<string,string>={preflop:'プリフロップ',flop:'フロップ',turn:'ターン',river:'リバー'};
/** Runs flags for hands in the worker: first preflop+flop for all, then turn+river hand by hand (onUpdate after each). */
export async function flagHands(hands:HandHistoryView[],onUpdate:(f:Record<string,HandFlags>,done:number,total:number)=>void,alive:()=>boolean){
 const own=hands.filter(h=>h.kind==='ring'&&h.players.some(p=>p.you&&p.hole?.length===2));if(!own.length){onUpdate({},0,0);return;}
 const {createGtoWorker}=await import('@/app/poker-demo/gto-worker-client');const w=createGtoWorker();let seq=0;
 const ask=(hs:GtoReviewHand[],streets:('preflop'|'flop'|'turn'|'river')[],budgetMs:number)=>new Promise<HandFlags[]|null>(resolve=>{
  const id=++seq,guard=window.setTimeout(()=>{w.removeEventListener('message',on);resolve(null);},60000);
  const on=(e:MessageEvent<GtoReply>)=>{if(e.data.id!==id)return;window.clearTimeout(guard);w.removeEventListener('message',on);resolve(e.data.type==='flags'?e.data.flags:null);};
  w.addEventListener('message',on);w.postMessage({type:'flags',id,hands:hs,streets,budgetMs} satisfies GtoRequest);});
 try{
  const first=await ask(own.map(toReviewHand),['preflop','flop'],0);if(!first||!alive())return;
  const all:Record<string,HandFlags>=Object.fromEntries(first.map(f=>[f.handId,f]));onUpdate({...all},0,own.length);
  // Turn and river need a live solve (about a second each): only hands where the viewer acted there.
  const late=own.filter(h=>h.actions.some(a=>(a.street==='turn'||a.street==='river')&&h.players.find(p=>p.you)?.seatId===a.seatId&&!['sb','bb','ante'].includes(a.type)));
  for(let i=0;i<late.length;i++){
   if(!alive())return;
   const r=await ask([toReviewHand(late[i])],['turn','river'],800);
   if(r?.[0]){const a=all[r[0].handId],b=r[0];all[b.handId]={...a,post:{judged:a.post.judged+b.post.judged,off:a.post.off+b.post.off},offs:[...a.offs,...b.offs]};}
   onUpdate({...all},i+1,late.length);
  }
 }finally{w.terminate();}
}
export function markOf(f:HandFlags):HandGtoMark{
 const n=f.pre.off+f.post.off;
 return {judged:f.pre.judged+f.post.judged,off:n,title:n?`GTOではほぼやらない打ち方 ${n}回：${f.offs.map(o=>`${STREET[o.street]}の${o.played}（${Math.round(o.freq*1000)/10}%）`).join('・')}`:''};
}

/** Owner 2026/10/31: ハンド履歴は10件ずつページ送り。 */
const PER_PAGE=10;
export function HandHistoryGto({hands,base,moreHref}:{hands:HandHistoryView[];base:string;moreHref?:string|null}){
 const [flags,setFlags]=useState<Record<string,HandFlags>|null>(null),[progress,setProgress]=useState<[number,number]|null>(null),[filter,setFilter]=useState<'all'|'pre'|'post'>('all'),[page,setPage]=useState(0);
 useEffect(()=>setPage(0),[hands,filter]);
 useEffect(()=>{let live=true;setFlags(null);
  void flagHands(hands,(f,done,total)=>{if(!live)return;setFlags(f);setProgress(done<total?[done,total]:null);},()=>live).catch(()=>{if(live)setProgress(null);});
  return ()=>{live=false;};},[hands]);
 const marks=useMemo(()=>flags?Object.fromEntries(Object.entries(flags as Record<string,HandFlags>).map(([k,f])=>[k,markOf(f)])):undefined,[flags]);
 const shown=filter==='all'||!flags?hands:hands.filter(h=>{const f=flags[h.handId];return f&&(filter==='pre'?f.pre.off>0:f.post.off>0);});
 const pages=Math.max(1,Math.ceil(shown.length/PER_PAGE));
 const count=(k:'pre'|'post')=>flags?Object.values(flags as Record<string,HandFlags>).filter(f=>f[k].off>0).length:0;
 return <>
  <div className={styles.gtoBar} role="group" aria-label="GTOで絞り込み">
   <button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>すべて</button>
   <button type="button" aria-pressed={filter==='pre'} disabled={!flags} onClick={()=>setFilter('pre')}>プリフロップでGTOとズレ（{count('pre')}）</button>
   <button type="button" aria-pressed={filter==='post'} disabled={!flags} onClick={()=>setFilter('post')}>フロップ以降でGTOとズレ（{count('post')}）</button>
   <small>{!flags?'GTOで判定中…':progress?`ターン・リバーを判定中 ${progress[0]}/${progress[1]}`:'「!」はGTOならほぼやらない（5%未満）打ち方があったハンド'}</small>
  </div>
  {shown.length?<HandHistoryList hands={shown.slice(page*PER_PAGE,(page+1)*PER_PAGE)} base={base} marks={marks}/>:<p>この条件のハンドはありません。</p>}
  {(pages>1||moreHref)&&<nav className={styles.pager} aria-label="ハンド履歴のページ">
   <button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>前の{PER_PAGE}件</button>
   <span>{Math.min(page+1,pages)} / {pages}{moreHref?'+':''}</span>
   {page<pages-1?<button type="button" onClick={()=>setPage(p=>p+1)}>次の{PER_PAGE}件</button>:moreHref?<a href={moreHref}>次の{PER_PAGE}件</a>:<button type="button" disabled>次の{PER_PAGE}件</button>}
  </nav>}
 </>;
}
