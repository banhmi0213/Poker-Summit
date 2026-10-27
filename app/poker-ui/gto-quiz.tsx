'use client';
import {useCallback,useEffect,useState} from 'react';
import {GTO_FLOPS,GTO_SPOTS,loadFlop,type FlopData,type FlopNode} from '@/lib/poker/gto-spots';
import styles from './gto-chart.module.css';

/** Practice quiz: a random precomputed flop decision; the answer is graded by how often GTO takes that action. */
const R='23456789TJQKA',S='cdhs',MARK:Record<string,string>={c:'♣',d:'♦',h:'♥',s:'♠'};
const cardText=(c:number)=>R[c>>2]+MARK[S[c&3]];
const pct=(v:number)=>`${Math.round(v*100)}%`;
type Question={spot:string;data:FlopData;node:FlopNode;nodeIndex:number;hand:string;cards:[number,number];history:string[]};
type Graded={choice:number;points:number;verdict:string};

/** Pick a concrete pair of cards for a hand class ("AKs", "QJo", "77") that does not clash with the board. */
function cardsFor(label:string,board:number[]):[number,number]|null{
 const a=R.indexOf(label[0]),b=R.indexOf(label[1]),opts:[number,number][]=[];
 for(let x=0;x<4;x++)for(let y=0;y<4;y++){
  if(a===b&&y<=x)continue;if(label[2]==='s'&&x!==y)continue;if(label[2]==='o'&&x===y)continue;
  const c1=a*4+x,c2=b*4+y;if(!board.includes(c1)&&!board.includes(c2))opts.push([c1,c2]);
 }
 return opts.length?opts[Math.floor(Math.random()*opts.length)]:null;
}
function pickWeighted<T>(items:T[],weight:(t:T)=>number){const total=items.reduce((s,t)=>s+weight(t),0);let r=Math.random()*total;for(const t of items){r-=weight(t);if(r<=0)return t;}return items[items.length-1];}

export function GtoQuiz(){
 const [spots,setSpots]=useState<string>('all'),[q,setQ]=useState<Question|null>(null),[graded,setGraded]=useState<Graded|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[score,setScore]=useState({count:0,points:0});
 const next=useCallback(async()=>{
  setLoading(true);setError('');setGraded(null);
  for(let attempt=0;attempt<10;attempt++){
   const spot=spots==='all'?GTO_SPOTS[Math.floor(Math.random()*GTO_SPOTS.length)].id:spots,flop=GTO_FLOPS[Math.floor(Math.random()*GTO_FLOPS.length)];
   const data=await loadFlop(spot,flop);if(!data)continue;
   // Mostly the first decision, sometimes one step later (after a check or a bet).
   let nodeIndex=0;const history:string[]=[];const root=data.nodes[0];
   if(Math.random()<.45){const kids=root.children.map((c,i)=>[c,i] as const).filter(([c])=>c!==null);if(kids.length){const [c,i]=kids[Math.floor(Math.random()*kids.length)];nodeIndex=c!;history.push(`${root.player===0?data.spot.oop:data.spot.ip} ${root.actions[i].label}`);}}
   const node=data.nodes[nodeIndex],entries=Object.entries(node.classes).filter(([,e])=>e[0]>0);if(!entries.length)continue;
   const [hand]=pickWeighted(entries,([,e])=>e[0]),cards=cardsFor(hand,data.board);if(!cards)continue;
   setQ({spot,data,node,nodeIndex,hand,cards,history});setLoading(false);return;
  }
  setLoading(false);setError('問題を用意できませんでした。計算が終わっている場面が少ないか、通信が不安定です。しばらくしてから試してください。');
 },[spots]);
 useEffect(()=>{void next();},[next]);
 const answer=(i:number)=>{
  if(!q||graded)return;const e=q.node.classes[q.hand],freqs=q.node.actions.map((_,k)=>e[k+1]),best=Math.max(...freqs),ratio=best>0?freqs[i]/best:0;
  const points=Math.round(ratio*100),verdict=ratio>=.8?'正解':ratio>=.3?'まずまず（GTOも混ぜて使う打ち方）':'ミス';
  setGraded({choice:i,points,verdict});setScore(s=>({count:s.count+1,points:s.points+points}));
 };
 const spotInfo=q?GTO_SPOTS.find(s=>s.id===q.spot):null;
 return <div className={styles.wrap}>
  <p>計算済みの場面から1問ずつ出題します。自分ならどう打つかを選ぶと、GTOがその手でそれぞれの打ち方をする割合と照らして採点します。いちばん多い打ち方を選べば100点、GTOが一部で混ぜる打ち方は割合に応じた点数です。</p>
  <div className={styles.form}>
   <label>出題する場面<select value={spots} onChange={e=>{setSpots(e.target.value);setScore({count:0,points:0});}}><option value="all">全部</option>{GTO_SPOTS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
   <span role="status">{score.count?`${score.count}問 ・ 平均 ${Math.round(score.points/score.count)}点`:'まだ解いていません'}</span>
  </div>
  {error&&<p role="alert">{error}</p>}
  {loading&&<p role="status">問題を用意しています…</p>}
  {q&&!loading&&<>
   <p className={styles.note}>{spotInfo?.label}：{spotInfo?.detail}</p>
   <p><b>ボード</b> {q.data.board.map(cardText).join(' ')}　<b>あなた（{q.node.player===0?q.data.spot.oop:q.data.spot.ip}）</b> {q.cards.map(cardText).join(' ')}</p>
   <p>{q.history.length?`${q.history.join('、')}。`:''}{q.node.player===0?`${q.data.spot.oop}（先に打つ人）`:`${q.data.spot.ip}（後に打つ人）`}のあなたの番です。どうしますか？</p>
   <div className={styles.path}>{q.node.actions.map((a,i)=><button key={i} type="button" disabled={Boolean(graded)} aria-pressed={graded?.choice===i} onClick={()=>answer(i)}>{a.label}</button>)}</div>
   {graded&&<div role="status">
    <p><b>{graded.verdict}</b>（{graded.points}点）</p>
    <p>GTOは {q.hand} で：{q.node.actions.map((a,i)=>`${a.label} ${pct(q.node.classes[q.hand][i+1])}`).join('・')}</p>
    <button type="button" onClick={()=>void next()}>次の問題</button>
   </div>}
  </>}
 </div>;
}
