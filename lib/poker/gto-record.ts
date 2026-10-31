import type {Card} from './engine';
import type {GtoView,LoggedAction,Street} from './gto-bot';
import {gradeChoice,type TrainerLevel} from './gto-trainer';

/** GTO records (owner 2026/11/1「プレイヤーがプレイした全部から収集」): one row per graded decision, from every place the
 * member plays — ring, tournaments, the CPU practice table, GTOと対戦, プリフロップ連打 and the quizzes. Rows go to
 * public.poker_gto_decisions through public.poker_gto_record (supabase/migrations/*_poker_gto_records.sql), and the
 * あかんとこ一覧 groups them by `spot`. Pure functions here; the browser sender is sendGtoRecords below. */
export const RECORD_SOURCES=['ring','tournament','practice','trainer','drill','quiz','daily'] as const;
export type GtoRecordSource=typeof RECORD_SOURCES[number];
export const SOURCE_TEXT:Record<GtoRecordSource,string>={ring:'リング',tournament:'大会',practice:'練習卓',trainer:'GTOと対戦',drill:'プリフロップ連打',quiz:'GTO練習クイズ',daily:'毎日のクイズ'};
export type GtoRecordRow={source:GtoRecordSource;
 /** The hand (or question) id, with step = the decision's place in it, so a decision sent twice is kept once. */
 ref?:string;step?:number;
 seats:number;stack:number;position:string;street:Street;spot:string;hand:string;board:string;
 action:string;freq:number|null;evLoss:number|null;level:TrainerLevel|null};

const RANKS='23456789TJQKA';
/** Starting-hand class: AKs, QJo, 77. */
export function handClass(hole:readonly Card[]){
 if(hole.length!==2)return '';
 const [a,b]=[...hole].sort((x,y)=>y.rank-x.rank),r=(c:Card)=>RANKS[c.rank-2];
 return a.rank===b.rank?r(a)+r(b):r(a)+r(b)+(a.suit===b.suit?'s':'o');
}
export const cardsKey=(cs:readonly Card[])=>cs.map(c=>RANKS[c.rank-2]+c.suit).join('');

const POST_ORDER=['SB','BB','UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN'];
/** The situation of a decision, coarse enough that the same mistake lands in one group:
 * preflop  pre:open:CO / pre:vsOpen:BB:BTN / pre:vs3bet:BTN:SB / pre:squeeze:BB / pre:vsLimp:BB / pre:vs4bet:SB …
 * postflop flop:srp:ip:first / turn:3bp:oop:facing … (pot type, position, and whether a bet is in front). */
export function spotOf(v:GtoView):string{
 const me=v.hero,pos=v.positions[me]??'?',street:Street=v.board.length===0?'preflop':v.board.length===3?'flop':v.board.length===4?'turn':'river';
 const pre=v.log.filter(a=>a.street==='preflop'),raises=pre.filter(a=>a.type==='raise'||a.type==='bet');
 if(street==='preflop'){
  const mine=pre.filter(a=>a.id===me),who=(a:LoggedAction|undefined)=>a?v.positions[a.id]??'?':'?';
  if(!raises.length)return pre.some(a=>a.type==='call')?`pre:vsLimp:${pos}`:`pre:open:${pos}`;
  const iRaised=raises.some(a=>a.id===me),last=raises[raises.length-1];
  if(raises.length===1){const callers=pre.filter(a=>a.type==='call'&&a.id!==me);return callers.length?`pre:squeeze:${pos}`:`pre:vsOpen:${pos}:${who(raises[0])}`;}
  if(raises.length===2)return iRaised?`pre:vs3bet:${pos}:${who(last)}`:`pre:vs3betCold:${pos}`;
  if(raises.length===3)return mine.length?`pre:vs4bet:${pos}:${who(last)}`:`pre:vs4betCold:${pos}`;
  return `pre:vs5bet:${pos}`;
 }
 const pot=raises.length===0?'limp':raises.length===1?'srp':raises.length===2?'3bp':'4bp';
 const live=v.players.filter(p=>!p.folded).map(p=>v.positions[p.id]??'?');
 const ip=live.every(p=>p===pos||POST_ORDER.indexOf(p)<POST_ORDER.indexOf(pos));
 const now=v.log.filter(a=>a.street===street),facing=now.some(a=>a.type==='bet'||a.type==='raise');
 return `${street}:${live.length>2?'multi':pot}:${ip?'ip':'oop'}:${facing?'facing':'first'}`;
}

const POT_TEXT:Record<string,string>={limp:'リンプのポット',srp:'シングルレイズのポット',['3bp']:'3ベットのポット',['4bp']:'4ベットのポット',multi:'3人以上のポット'};
const STREET_TEXT:Record<string,string>={flop:'フロップ',turn:'ターン',river:'リバー'};
/** The spot in words, for the list. */
export function spotLabel(key:string):string{
 const p=key.split(':');
 if(p[0]==='pre'){
  const [,k,me,them]=p;
  switch(k){
   case 'open':return `${me}：誰も参加していないとき（オープンするか）`;
   case 'vsLimp':return `${me}：リンプが入ったとき`;
   case 'vsOpen':return `${me}：${them}のオープンを受けたとき`;
   case 'squeeze':return `${me}：オープンとコールが入ったとき`;
   case 'vs3bet':return `${me}：オープンして${them}に3ベットされたとき`;
   case 'vs3betCold':return `${me}：オープンと3ベットが入ったとき`;
   case 'vs4bet':return `${me}：3ベットして${them}に4ベットされたとき`;
   case 'vs4betCold':return `${me}：4ベットまで入ったとき`;
   case 'vs5bet':return `${me}：5ベット（オールイン）を受けたとき`;
  }
  return key;
 }
 const [street,pot,side,facing]=p;
 return `${STREET_TEXT[street]??street}・${POT_TEXT[pot]??pot}・${side==='ip'?'後に打つ側（IP）':'先に打つ側（OOP）'}・${facing==='facing'?'ベットを受けたとき':'自分から打つとき'}`;
}

/** One row from a graded choice (freqs = GTO's share of each option, chosen = the index played). */
export function recordRow(v:GtoView,source:GtoRecordSource,o:{freqs:readonly number[];chosen:number;action:string;evLoss:number|null;seats?:number;ref?:string;step?:number}):GtoRecordRow{
 const g=gradeChoice(o.freqs,o.chosen),me=v.players.find(p=>p.id===v.hero);
 const stack=Math.round(((v.startStacks[v.hero]??me?.stack??0)/v.bb)*10)/10;
 const street:Street=v.board.length===0?'preflop':v.board.length===3?'flop':v.board.length===4?'turn':'river';
 return {source,...(o.ref?{ref:o.ref,step:o.step??0}:{}),seats:o.seats??v.players.length,stack,position:v.positions[v.hero]??'?',street,spot:spotOf(v),
  hand:handClass(v.hole),board:cardsKey(v.board),action:o.action.slice(0,40),freq:Math.round(g.freq*1000)/1000,evLoss:o.evLoss===null?null:Math.round(o.evLoss*100)/100,level:g.level};
}

// Browser: rows are queued and sent in one request a moment later; nothing is sent for guests (the API answers 401 and
// the queue stops for this page).
let queue:GtoRecordRow[]=[],timer:ReturnType<typeof setTimeout>|null=null,off=false;
function flush(){
 timer=null;const batch=queue.splice(0,200);if(!batch.length)return;
 void fetch('/api/poker/gto-records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:batch}),keepalive:true})
  .then(r=>{if(r.status===401){off=true;queue=[];}else if(queue.length&&!timer)timer=setTimeout(flush,500);}).catch(()=>{});
}
export function sendGtoRecords(rows:GtoRecordRow[]){
 if(off||typeof window==='undefined'||!rows.length)return;
 queue.push(...rows);if(queue.length>2000)queue=queue.slice(-2000);
 if(!timer)timer=setTimeout(flush,1500);
}
