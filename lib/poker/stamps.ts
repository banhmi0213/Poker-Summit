/** Table stamps (owner 2026/10/27: no free chat at launch; stamps only). Fixed phrases, so they cannot be abused. */
/** Character stamps (owner 2026/10/27: キャラ＋ポーカーあるあるの一言、標準語). `image` is Daniel's drawing (512×512, transparent,
 * top third left empty for the phrase); 13・14 added by the owner. No sub line (owner: 補足はいらん). `tone` colours the phrase. */
const STAMP_LIST=[
 {id:'hello',label:'よろしく！',tone:'g',image:'/images/stamps/stamp-01.webp'},
 {id:'nice',label:'ナイス！',tone:'y',image:'/images/stamps/stamp-02.webp'},
 {id:'allin',label:'オールイン！',tone:'r',image:'/images/stamps/stamp-03.webp'},
 {id:'read',label:'読まれてた…',tone:'b',image:'/images/stamps/stamp-04.webp'},
 {id:'river',label:'リバーで…',tone:'b',image:'/images/stamps/stamp-05.webp'},
 {id:'nobluff',label:'ブラフじゃない',tone:'y',image:'/images/stamps/stamp-06.webp'},
 {id:'pray',label:'祈り中',tone:'r',image:'/images/stamps/stamp-07.webp'},
 {id:'nicefold',label:'いい降り！',tone:'g',image:'/images/stamps/stamp-08.webp'},
 {id:'shaking',label:'震えてる',tone:'b',image:'/images/stamps/stamp-09.webp'},
 {id:'gotme',label:'やられた！',tone:'r',image:'/images/stamps/stamp-10.webp'},
 {id:'thanks',label:'ありがとう',tone:'y',image:'/images/stamps/stamp-11.webp'},
 {id:'bye',label:'おつかれ！',tone:'g',image:'/images/stamps/stamp-12.webp'},
 {id:'burning',label:'焼けてる？',tone:'r',image:'/images/stamps/stamp-13.webp'},
 {id:'tilt',label:'ティルト',tone:'r',image:'/images/stamps/stamp-14.webp'},
] as const;
export type StampId=typeof STAMP_LIST[number]['id'];
export type Stamp={id:StampId;label:string;tone:'r'|'y'|'b'|'g';image?:string};
export const STAMPS:readonly Stamp[]=STAMP_LIST;
/** Shown for 3 seconds (owner 2026/10/27); one per member every 3 seconds, a newer one replaces the seat's stamp. */
export const STAMP_SHOW_MS=3000,STAMP_GAP_MS=3000;
export const stampLabel=(id:string)=>STAMPS.find(s=>s.id===id)?.label??'';
export const stampOf=(id:string)=>STAMPS.find(s=>s.id===id)??null;
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
