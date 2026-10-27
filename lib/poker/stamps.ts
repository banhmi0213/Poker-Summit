/** Table stamps (owner 2026/10/27: no free chat at launch; stamps only). Fixed phrases, so they cannot be abused. */
export const STAMPS=[
 {id:'hello',label:'よろしく'},{id:'nh',label:'ナイスハンド'},{id:'gg',label:'おつかれ'},{id:'ty',label:'ありがとう'},
 {id:'clap',label:'👏'},{id:'laugh',label:'😂'},{id:'shock',label:'😱'},{id:'think',label:'🤔'},
] as const;
export type StampId=typeof STAMPS[number]['id'];
export const STAMP_SHOW_MS=4000,STAMP_GAP_MS=3000;
export const stampLabel=(id:string)=>STAMPS.find(s=>s.id===id)?.label??'';
export const isStampId=(v:unknown):v is StampId=>typeof v==='string'&&STAMPS.some(s=>s.id===v);
export type TableStamp={seat:number;stamp:StampId;at:number};
/** In-memory recent stamps per table (the room server is a single process; stamps are not stored). */
export class StampBoard{
 #tables=new Map<string,TableStamp[]>();#last=new Map<string,number>();
 constructor(private now:()=>number=Date.now){}
 /** Returns false when the member sent one less than STAMP_GAP_MS ago. */
 post(table:string,member:string,seat:number,stamp:StampId){const t=this.now(),last=this.#last.get(member)??-Infinity;if(t-last<STAMP_GAP_MS)return false;this.#last.set(member,t);
  const list=(this.#tables.get(table)??[]).filter(s=>t-s.at<STAMP_SHOW_MS&&s.seat!==seat);list.push({seat,stamp,at:t});this.#tables.set(table,list);
  if(this.#last.size>5000)for(const [k,v] of this.#last)if(t-v>STAMP_GAP_MS)this.#last.delete(k);
  return true;}
 recent(table:string){const t=this.now(),list=(this.#tables.get(table)??[]).filter(s=>t-s.at<STAMP_SHOW_MS);if(list.length)this.#tables.set(table,list);else this.#tables.delete(table);return list.map(s=>({...s,age:t-s.at}));}
}
