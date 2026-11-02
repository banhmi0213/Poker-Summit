'use client';
import type {GtoReply,GtoRequest} from '@/lib/poker/gto.worker';
import type {LiveDecision} from '@/lib/poker/gto-review';
import {sendGtoRecords,type GtoRecordRow} from '@/lib/poker/gto-record';

/** Practice table (CPU) hands into the GTO records (owner 2026/11/1「全部から収集」): the hand is saved for a logged-in
 * member, then its decisions are judged in the table's GTO worker and sent with ref = the saved hand. Guests: the save
 * answers 401 and nothing more is tried on this page. Never blocks or changes the table. */
let guest=false,seq=2_000_000_000;
export function recordPracticeHand(worker:Worker|null,o:{decisions:LiveDecision[];seats:number;net:number;hand:Record<string,unknown>}){
 if(guest||!worker||!o.decisions.length||typeof window==='undefined')return;
 void (async()=>{
  try{
   const r=await fetch('/api/poker/gto-records/practice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seats:o.seats,net:Math.round(o.net*10)/10,hand:o.hand})});
   if(r.status===401){guest=true;return;}if(!r.ok)return;
   const ref=String((await r.json()).id??'');if(!ref)return;
   const id=++seq;
   const rows=await new Promise<GtoRecordRow[]>(resolve=>{
    const guard=window.setTimeout(()=>{worker.removeEventListener('message',on);resolve([]);},60000);
    const on=(e:MessageEvent<GtoReply>)=>{if(e.data.id!==id)return;window.clearTimeout(guard);worker.removeEventListener('message',on);resolve(e.data.type==='records'?e.data.rows:[]);};
    worker.addEventListener('message',on);worker.postMessage({type:'liveRecords',id,items:o.decisions,ref,budgetMs:1500} satisfies GtoRequest);
   });
   sendGtoRecords(rows);
  }catch{/* records are a convenience; the table goes on */}
 })();
}
