/** GTO practice questions (owner 2026/10/27: 「問題形式で練習できる学習モード」).
 * Preflop questions come from the solved 6-max chart, flop questions from the precomputed flop solutions.
 * Pure: the caller loads the data and supplies the random source. */
import {flopRow,preflopHistory,preflopReach,type PreflopData,type PreflopNode} from './gto-bot';
import {madeHandLabel} from './card-display';
import type {Card} from './engine';
import {seatOf,type FlopData,type FlopNode} from './gto-spots';

const R='23456789TJQKA',S='cdhs';
export type QuizQuestion={
 kind:'preflop'|'flop';
 /** Result category kept per member: preflop-<chart kind> or flop-<spot id>. */
 category:string;
 /** Short name of the situation, e.g. 「BTN対BB・フロップ」. */
 title:string;
 /** What happened before the hero's decision. */
 scene:string;
 hero:string;
 cards:[number,number];
 board:number[];
 handClass:string;
 options:string[];
 /** GTO frequencies for the hero's hand (sum 1). */
 freqs:number[];
 /** The same for the hero's whole range at this decision (sum 1). */
 rangeFreqs:number[];
 /** Made hand on the board (flop questions). */
 made:string|null;
};
export type QuizGrade={choice:number;freq:number;points:number;verdict:'正解'|'まずまず'|'ミス'};

export const toCard=(c:number):Card=>({rank:((c>>2)+2) as Card['rank'],suit:S[c&3] as Card['suit']});
export const combosOf=(cls:string)=>cls.length===2?6:cls[2]==='s'?4:12;
const pct=(v:number)=>`${Math.round(v*100)}%`;
const norm=(xs:number[])=>{const t=xs.reduce((s,x)=>s+Math.max(0,x),0);return t>0?xs.map(x=>Math.max(0,x)/t):xs.map(()=>1/xs.length);};
function pick<T>(items:readonly T[],weight:(t:T)=>number,random:()=>number):T|null{
 const w=items.map(weight),total=w.reduce((s,x)=>s+x,0);if(!(total>0))return null;
 let r=random()*total;for(let i=0;i<items.length;i++){r-=w[i];if(r<=0)return items[i];}return items[items.length-1];
}
/** A concrete pair of cards for a class ("AKs", "QJo", "77") that does not clash with the board. */
export function cardsFor(cls:string,board:readonly number[],random:()=>number):[number,number]|null{
 const a=R.indexOf(cls[0]),b=R.indexOf(cls[1]),opts:[number,number][]=[];
 for(let x=0;x<4;x++)for(let y=0;y<4;y++){
  if(a===b&&y<=x)continue;if(cls[2]==='s'&&x!==y)continue;if(cls[2]==='o'&&x===y)continue;
  const c1=a*4+x,c2=b*4+y;if(!board.includes(c1)&&!board.includes(c2))opts.push([c1,c2]);
 }
 return opts.length?opts[Math.floor(random()*opts.length)]:null;
}
/** Weight for choosing the hand: hands that are actually held here, more often the ones worth thinking about
 * (mixed strategies, hands near the edge of the range), less often the obvious folds. */
function handWeight(reach:number,combos:number,freqs:number[],foldIndex:number){
 if(!(reach>0.02))return 0;
 const top=Math.max(...freqs),mixed=1-top,fold=foldIndex>=0?freqs[foldIndex]:0;
 return reach*combos*(1+4*mixed)*(fold>0.98?0.25:1);
}
/** 当たり前すぎる問題は出さない (owner 2026/11/06, after outside feedback): a question is worth asking only when the
 * answer is not obvious from the data itself — the hand mixes (second choice at least 10%), or, for a pure hand, a
 * neighbouring hand (one kicker or one pair rank away) plays differently, so it sits on the edge of the range. A
 * decision where the whole range does one thing 90% or more (e.g. a small c-bet with everything) is never asked. */
export const QUIZ_MIX=0.1;
const second=(xs:number[])=>[...xs].sort((a,b)=>b-a)[1]??0;
const argmax=(xs:number[])=>xs.indexOf(Math.max(...xs));
function neighbours(cls:string):string[]{
 const a=R.indexOf(cls[0]),b=R.indexOf(cls[1]),out:string[]=[];
 if(a===b){for(const d of [-1,1])if(R[a+d])out.push(R[a+d]+R[a+d]);return out;}
 for(const d of [-1,1]){const k=b+d;if(k>=0&&k<a)out.push(R[a]+R[k]+cls[2]);}
 out.push(R[a]+R[b]+(cls[2]==='s'?'o':'s'));
 return out;
}
export function worthAsking(freqs:number[],rangeFreqs:number[],edge=false){
 if(Math.max(...rangeFreqs)>=0.9)return false;
 return second(freqs)>=QUIZ_MIX||edge;
}
const onEdge=(strategy:Record<string,number[]>,cls:string,reach:Record<string,number>)=>{
 const mine=argmax(strategy[cls]);return neighbours(cls).some(n=>strategy[n]&&reach[n]>0.02&&argmax(strategy[n])!==mine);
};

// ---------- preflop ----------
const KIND_WEIGHT:Record<string,number>={open:30,vsOpen:35,vs3bet:22,overcall:5,vs4bet:6,vs5bet:2,vsLimp:6,vsIso:4,vsSqueeze:3};
function sceneText(node:PreflopNode){
 const toks=preflopHistory(node);let raises=0,limped=false;const parts:string[]=[];let folds:string[]=[];
 const flush=()=>{if(folds.length){parts.push(`${folds.join('・')}がフォールド`);folds=[];}};
 for(const t of toks){
  if(t.kind==='F'){folds.push(t.pos);continue;}
  flush();
  if(t.kind==='C'){parts.push(raises>0?`${t.pos}がコール`:limped?`${t.pos}がチェック`:`${t.pos}がリンプ`);if(!raises)limped=true;}
  else{raises++;const size=t.to>=100?'オールイン':`${t.to}BB`;
   parts.push(raises===1&&limped?`${t.pos}が${size}にレイズ`:raises===1?`${t.pos}が${size}でオープン`:`${t.pos}が${size === 'オールイン'?'オールイン':`${size}に${raises===2?'3ベット':raises===3?'4ベット':'5ベット'}`}`);}
 }
 flush();
 return parts.length?`${parts.join('、')}。`:'';
}
/** Category names shown to members. */
export const PREFLOP_CATEGORY:Record<string,string>={'preflop-open':'プリフロップ：オープン','preflop-vsopen':'プリフロップ：オープンを受けて','preflop-vs3bet':'プリフロップ：3ベットを受けて','preflop-vs4bet':'プリフロップ：4ベットを受けて','preflop-vs5bet':'プリフロップ：5ベットを受けて','preflop-vslimp':'プリフロップ：リンプを受けて','preflop-vsiso':'プリフロップ：リンプ後にレイズされて','preflop-vssqueeze':'プリフロップ：スクイーズを受けて','preflop-overcall':'プリフロップ：オーバーコール'};
/** `kind`: only that chart kind (open, vsOpen, …), e.g. to practise a weak category. */
export function preflopQuestion(data:PreflopData,random:()=>number=Math.random,kind?:string):QuizQuestion|null{
 for(let attempt=0;attempt<8;attempt++){
  const node=pick(data.nodes,n=>kind&&n.kind.toLowerCase()!==kind.toLowerCase()?0:(KIND_WEIGHT[n.kind]??1)/Math.max(1,data.nodes.filter(m=>m.kind===n.kind).length),random);if(!node)return null;
  const reach=preflopReach(data,node),fold=node.actions.findIndex(a=>a.kind==='fold');
  const classes=Object.keys(node.strategy);
  const range=node.actions.map((_,k)=>classes.reduce((s,c)=>s+reach[c]*combosOf(c)*(node.strategy[c][k]??0),0)),rangeN=norm(range);
  const cls=pick(classes,c=>worthAsking(node.strategy[c],rangeN,onEdge(node.strategy,c,reach))?handWeight(reach[c],combosOf(c),node.strategy[c],fold):0,random);if(!cls)continue;
  const cards=cardsFor(cls,[],random);if(!cards)continue;
  return {kind:'preflop',category:`preflop-${node.kind.toLowerCase()}`,title:'6人テーブル・100BB・プリフロップ',scene:sceneText(node),hero:node.player,cards,board:[],handClass:cls,
   options:node.actions.map(a=>a.label),freqs:norm(node.strategy[cls]),rangeFreqs:rangeN,made:null};
 }
 return null;
}

// ---------- flop ----------
/** 「ベット 33%」→「ポットの33%をベット」, 「レイズ 2.5倍」→「2.5倍にレイズ」 for the scene sentence. */
const actionPhrase=(label:string)=>label.replace(/^ベット ([\d.]+)%$/,'ポットの$1%をベット').replace(/^レイズ ([\d.]+)倍$/,'$1倍にレイズ');
/** The decision to ask about: mostly the first one, sometimes after one action (a check, or facing a bet). */
function flopNodeFor(file:FlopData,random:()=>number):{node:FlopNode;history:string[]}{
 const root=file.nodes[0];
 if(random()<0.45){
  const kids=root.children.map((c,i)=>[c,i] as const).filter(([c])=>c!==null);
  if(kids.length){const [c,i]=kids[Math.floor(random()*kids.length)];return {node:file.nodes[c!],history:[`${seatOf(file,root.player)}が${actionPhrase(root.actions[i].label)}`]};}
 }
 return {node:root,history:[]};
}
export function flopQuestion(file:FlopData,spot:string,title:string,detail:string,random:()=>number=Math.random):QuizQuestion|null{
 for(let attempt=0;attempt<6;attempt++){
  const {node,history}=flopNodeFor(file,random),fold=node.actions.findIndex(a=>a.kind==='fold');
  const classes=Object.keys(node.classes);
  if(!worthAsking(node.total,norm(node.total),true))continue;
  const cls=pick(classes,c=>second(node.classes[c].slice(1))>=QUIZ_MIX?handWeight(node.classes[c][0],combosOf(c),node.classes[c].slice(1),fold):0,random);if(!cls)continue;
  const cards=cardsFor(cls,file.board,random);if(!cards)continue;
  // Suit-aware row for these exact cards when the file has one (flush draws, backdoors).
  const row=flopRow(node,cards[0],cards[1],file.board)??node.classes[cls];if(!row||!(row[0]>0)||second(row.slice(1))<QUIZ_MIX)continue;
  const hero=seatOf(file,node.player);
  return {kind:'flop',category:`flop-${spot}`,title,scene:`${detail}。${history.length?`フロップで${history.join('、')}。`:''}`,hero,cards,board:[...file.board],handClass:cls,
   options:node.actions.map(a=>a.label),freqs:norm(row.slice(1)),rangeFreqs:norm(node.total),made:madeHandLabel(cards.map(toCard),file.board.map(toCard))};
 }
 return null;
}

// ---------- grading and explanation ----------
/** The most frequent option scores 100; others by their share of it. 80+ = 正解, 30+ = まずまず. */
export function gradeQuiz(q:QuizQuestion,choice:number):QuizGrade{
 const best=Math.max(...q.freqs),freq=q.freqs[choice]??0,ratio=best>0?freq/best:0;
 return {choice,freq,points:Math.round(ratio*100),verdict:ratio>=0.8?'正解':ratio>=0.3?'まずまず':'ミス'};
}
const listText=(q:QuizQuestion,freqs:number[])=>freqs.map((f,i)=>[q.options[i],f] as const).filter(([,f])=>f>=0.005).sort((a,b)=>b[1]-a[1]).map(([o,f])=>`「${o}」${pct(f)}`).join('・');
/** Lines shown after answering (owner 2026/11/06: 根拠のない説明文は出さない). Only what the computed data says: the
 * frequencies for this hand, where the chosen option stands among them, the whole range's frequencies, and the made
 * hand on the board. No reasons are written in words, because the data holds frequencies, not reasons. */
export function explainQuiz(q:QuizQuestion,g:QuizGrade):string[]{
 const best=q.freqs.indexOf(Math.max(...q.freqs));
 const out=[`GTOの割合（${q.handClass}）：${listText(q,q.freqs)}`];
 out.push(g.choice===best?`あなたの選択「${q.options[g.choice]}」：${pct(g.freq)}（いちばん多い打ち方）`:`あなたの選択「${q.options[g.choice]}」：${pct(g.freq)}（いちばん多いのは「${q.options[best]}」${pct(q.freqs[best])}）`);
 out.push(`${q.hero}の手全体の割合：${listText(q,q.rangeFreqs)}`);
 if(q.made)out.push(`いまの役：${q.made}`);
 return out;
}
