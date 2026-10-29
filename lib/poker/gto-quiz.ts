/** GTO practice questions (owner 2026/10/27: 「問題形式で練習できる学習モード」).
 * Preflop questions come from the solved 6-max chart, flop questions from the precomputed flop solutions.
 * Pure: the caller loads the data and supplies the random source. */
import {flopRow,preflopHistory,preflopReach,type PreflopData,type PreflopNode} from './gto-bot';
import {madeHandLabel} from './card-display';
import type {Card} from './engine';
import type {FlopData,FlopNode} from './gto-spots';

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

// ---------- preflop ----------
const KIND_WEIGHT:Record<string,number>={open:30,vsOpen:35,vs3bet:22,overcall:5,vs4bet:6,vs5bet:2,vsLimp:6,vsIso:4};
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
export const PREFLOP_CATEGORY:Record<string,string>={'preflop-open':'プリフロップ：オープン','preflop-vsopen':'プリフロップ：オープンを受けて','preflop-vs3bet':'プリフロップ：3ベットを受けて','preflop-vs4bet':'プリフロップ：4ベットを受けて','preflop-vs5bet':'プリフロップ：5ベットを受けて','preflop-vslimp':'プリフロップ：リンプを受けて','preflop-vsiso':'プリフロップ：リンプ後にレイズされて','preflop-overcall':'プリフロップ：オーバーコール'};
/** `kind`: only that chart kind (open, vsOpen, …), e.g. to practise a weak category. */
export function preflopQuestion(data:PreflopData,random:()=>number=Math.random,kind?:string):QuizQuestion|null{
 for(let attempt=0;attempt<8;attempt++){
  const node=pick(data.nodes,n=>kind&&n.kind.toLowerCase()!==kind.toLowerCase()?0:(KIND_WEIGHT[n.kind]??1)/Math.max(1,data.nodes.filter(m=>m.kind===n.kind).length),random);if(!node)return null;
  const reach=preflopReach(data,node),fold=node.actions.findIndex(a=>a.kind==='fold');
  const classes=Object.keys(node.strategy);
  const cls=pick(classes,c=>handWeight(reach[c],combosOf(c),node.strategy[c],fold),random);if(!cls)continue;
  const cards=cardsFor(cls,[],random);if(!cards)continue;
  const range=node.actions.map((_,k)=>classes.reduce((s,c)=>s+reach[c]*combosOf(c)*(node.strategy[c][k]??0),0));
  return {kind:'preflop',category:`preflop-${node.kind.toLowerCase()}`,title:`6人卓・100BB・プリフロップ`,scene:sceneText(node),hero:node.player,cards,board:[],handClass:cls,
   options:node.actions.map(a=>a.label),freqs:norm(node.strategy[cls]),rangeFreqs:norm(range),made:null};
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
  if(kids.length){const [c,i]=kids[Math.floor(random()*kids.length)];return {node:file.nodes[c!],history:[`${root.player===0?file.spot.oop:file.spot.ip}が${actionPhrase(root.actions[i].label)}`]};}
 }
 return {node:root,history:[]};
}
export function flopQuestion(file:FlopData,spot:string,title:string,detail:string,random:()=>number=Math.random):QuizQuestion|null{
 for(let attempt=0;attempt<6;attempt++){
  const {node,history}=flopNodeFor(file,random),fold=node.actions.findIndex(a=>a.kind==='fold');
  const classes=Object.keys(node.classes);
  const cls=pick(classes,c=>handWeight(node.classes[c][0],combosOf(c),node.classes[c].slice(1),fold),random);if(!cls)continue;
  const cards=cardsFor(cls,file.board,random);if(!cards)continue;
  // Suit-aware row for these exact cards when the file has one (flush draws, backdoors).
  const row=flopRow(node,cards[0],cards[1],file.board)??node.classes[cls];if(!row||!(row[0]>0))continue;
  const hero=node.player===0?file.spot.oop:file.spot.ip;
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
const aggressive=(label:string)=>/ベット|レイズ|オープン|オールイン/.test(label);
const listText=(q:QuizQuestion,freqs:number[])=>freqs.map((f,i)=>[q.options[i],f] as const).filter(([,f])=>f>=0.005).sort((a,b)=>b[1]-a[1]).map(([o,f])=>`「${o}」${pct(f)}`).join('・');
/** Lines of explanation shown after answering. */
export function explainQuiz(q:QuizQuestion,g:QuizGrade):string[]{
 const order=q.freqs.map((f,i)=>[f,i] as const).sort((a,b)=>b[0]-a[0]),best=order[0][1],bestLabel=q.options[best];
 const out:string[]=[];
 out.push(`GTOは${q.handClass}で：${listText(q,q.freqs)}`);
 if(g.verdict==='正解')out.push(order[0][0]>=0.9?`「${q.options[g.choice]}」がこの手の決まった打ち方です。`:`「${q.options[g.choice]}」はこの手でいちばん多い打ち方の一つです。`);
 else if(g.verdict==='まずまず')out.push(`「${q.options[g.choice]}」もGTOが${pct(g.freq)}混ぜる打ち方です。いちばん多いのは「${bestLabel}」。`);
 else out.push(g.freq>=0.005?`「${q.options[g.choice]}」はGTOでは${pct(g.freq)}しか選びません。基本は「${bestLabel}」です。`:`「${q.options[g.choice]}」はGTOでは選ばない打ち方です。基本は「${bestLabel}」です。`);
 if(order[0][0]<0.7&&order.length>1&&order[1][0]>=0.2)out.push(`この手は「${bestLabel}」と「${q.options[order[1][1]]}」を混ぜる手です。どちらか一つに決めず、割合どおりに打ち分けるのがGTOです。`);
 out.push(`この場面で${q.hero}が持っている手全体では：${listText(q,q.rangeFreqs)}`);
 const handAgg=q.options.reduce((s,o,i)=>s+(aggressive(o)?q.freqs[i]:0),0),rangeAgg=q.options.reduce((s,o,i)=>s+(aggressive(o)?q.rangeFreqs[i]:0),0);
 const fold=q.options.findIndex(o=>o==='フォールド'),handFold=fold>=0?q.freqs[fold]:0,rangeFold=fold>=0?q.rangeFreqs[fold]:0;
 if(handFold>=0.9&&rangeFold<0.9)out.push(`${q.handClass}はこの場面で続けるには弱く、降りる側の手です。`);
 else if(rangeAgg>0.02&&rangeAgg<0.7&&handAgg>=Math.min(0.9,rangeAgg*1.8))out.push(`${q.handClass}は全体より攻める割合が高い手です（全体 ${pct(rangeAgg)}、この手 ${pct(handAgg)}）。強い手としての攻めか、ブラフに向いた手です。`);
 else if(rangeAgg>0.1&&handAgg<rangeAgg*0.4&&handFold<0.5)out.push(`${q.handClass}は攻めるより受けて続ける側の手です（攻める割合 全体 ${pct(rangeAgg)}、この手 ${pct(handAgg)}）。`);
 if(q.made)out.push(`いまの役：${q.made}`);
 return out;
}
