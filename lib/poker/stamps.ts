/** Table stamps (owner 2026/10/27: no free chat at launch; stamps only). Fixed phrases, so they cannot be abused. */
/** Character stamps (owner 2026/10/27: キャラ＋ポーカーあるあるの一言、標準語). `image` is Daniel's drawing; until it
 * arrives the stamp is drawn with the thumb logo and the phrase. `tone` colours the phrase. */
const STAMP_LIST=[
 {id:'hello',label:'よろしく！',sub:'お願いします',tone:'g'},
 {id:'nice',label:'ナイス！',sub:'いい手！',tone:'y'},
 {id:'allin',label:'オールイン！',sub:'勝負！',tone:'r'},
 {id:'read',label:'読まれてた…',sub:'完敗です',tone:'b'},
 {id:'river',label:'リバーで…',sub:'うそでしょ',tone:'b'},
 {id:'nobluff',label:'ブラフじゃない',sub:'本当だよ',tone:'y'},
 {id:'pray',label:'祈り中',sub:'お願い…！',tone:'r'},
 {id:'nicefold',label:'いい降り！',sub:'ナイスフォールド',tone:'g'},
 {id:'shaking',label:'震えてる',sub:'ドキドキ',tone:'b'},
 {id:'gotme',label:'やられた！',sub:'参りました',tone:'r'},
 {id:'thanks',label:'ありがとう',sub:'感謝です',tone:'y'},
 {id:'bye',label:'おつかれ！',sub:'また遊ぼう',tone:'g'},
] as const;
export type StampId=typeof STAMP_LIST[number]['id'];
export type Stamp={id:StampId;label:string;sub:string;tone:'r'|'y'|'b'|'g';image?:string};
export const STAMPS:readonly Stamp[]=STAMP_LIST;
export const STAMP_SHOW_MS=4000,STAMP_GAP_MS=3000;
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
