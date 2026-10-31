'use client';
import type {GtoReply,GtoRequest} from '@/lib/poker/gto.worker';
import type {GtoRecordRow} from '@/lib/poker/gto-record';
import type {HandHistoryView} from '@/lib/poker/hand-histories';
import {toReviewHand} from './hand-history-gto';

/** GTO records from ring and tournament hands (owner 2026/11/1「全部から収集」): the member's latest 100 hands are judged
 * in the GTO worker once each (hands that already have records are skipped) and saved with sendable rows. Runs quietly in
 * the background of mypage; returns how many decisions were added. Preflop and flop are judged together; turn and river
 * need a live solve, so they go one hand at a time. */
let running:Promise<number>|null=null;
export function syncHandRecords(onProgress?:(done:number,total:number)=>void):Promise<number>{
 running??=run(onProgress).finally(()=>{running=null;});
 return running;
}
async function post(rows:GtoRecordRow[]){
 let added=0;
 for(let i=0;i<rows.length;i+=200){
  const r=await fetch('/api/poker/gto-records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:rows.slice(i,i+200)})});
  if(!r.ok)break;added+=Number((await r.json()).added)||0;
 }
 return added;
}
async function run(onProgress?:(done:number,total:number)=>void){
 const res=await fetch('/api/poker/recent-hands?kinds=ring,tournament',{cache:'no-store'});if(!res.ok)return 0;
 const hands=((await res.json()).hands??[]) as HandHistoryView[];if(!hands.length)return 0;
 const known=new Set<string>();
 for(const source of ['ring','tournament'] as const){
  const refs=hands.filter(h=>h.kind===source).map(h=>h.handId);if(!refs.length)continue;
  const r=await fetch('/api/poker/gto-records/refs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source,refs})});
  if(!r.ok)return 0;for(const x of ((await r.json()).refs??[]) as string[])known.add(x);
 }
 const todo=hands.filter(h=>!known.has(h.handId));if(!todo.length)return 0;
 const {createGtoWorker}=await import('@/app/poker-demo/gto-worker-client');const w=createGtoWorker();let seq=0;
 const ask=(hs:HandHistoryView[],source:'ring'|'tournament',streets:('preflop'|'flop'|'turn'|'river')[],budgetMs:number)=>new Promise<GtoRecordRow[]>(resolve=>{
  const id=++seq,guard=window.setTimeout(()=>{w.removeEventListener('message',on);resolve([]);},90000);
  const on=(e:MessageEvent<GtoReply>)=>{if(e.data.id!==id)return;window.clearTimeout(guard);w.removeEventListener('message',on);resolve(e.data.type==='records'?e.data.rows:[]);};
  w.addEventListener('message',on);w.postMessage({type:'records',id,hands:hs.map(toReviewHand),source,streets,budgetMs} satisfies GtoRequest);});
 let added=0;
 try{
  for(const source of ['ring','tournament'] as const){
   const mine=todo.filter(h=>h.kind===source);if(!mine.length)continue;
   added+=await post(await ask(mine,source,['preflop','flop'],0));
  }
  const late=todo.filter(h=>h.actions.some(a=>(a.street==='turn'||a.street==='river')&&h.players.find(p=>p.you)?.seatId===a.seatId&&!['sb','bb','ante'].includes(a.type)));
  for(let i=0;i<late.length;i++){
   onProgress?.(i,late.length);
   added+=await post(await ask([late[i]],late[i].kind,['turn','river'],800));
  }
  onProgress?.(late.length,late.length);
 }finally{w.terminate();}
 return added;
}
