'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {recordRow,sendGtoRecords} from '@/lib/poker/gto-record';
import type {Card} from '@/lib/poker/engine';
import type {BettingAction} from '@/lib/poker/betting';
import {toTable} from '@/lib/poker/gto-bot';
import type {GtoReply,GtoRequest} from '@/lib/poker/gto.worker';
import {reasonText,type TrainerSpot} from '@/lib/poker/gto-review';
import {HERO,LEVEL_TEXT,MODE_POSITIONS,MODE_TEXT,TRAINER_BB,TRAINER_LEVELS,TRAINER_SEATS,buttonIndexFor,evLoss,gradeChoice,netBB,startTrainerHand,trainerAct,trainerView,visibleBoard,type TrainerHand,type TrainerLevel,type TrainerMode} from '@/lib/poker/gto-trainer';
import chart from './gto-chart.module.css';
import styles from './gto-trainer.module.css';
import {StoreInvite} from './store-invite';
import {PreflopDrill} from './preflop-drill';

/** 「GTOと対戦」(owner 2026/10/30: GTOと対戦がいっちゃん勉強になる): six-handed table, five GTO CPUs, the hero's cards
 * face up and the hero's seat moving one position every hand. Every hero decision is graded on the spot against how
 * often GTO takes that action with that hand; the hand plays on to the end, then all cards are shown. */
const SUIT:Record<Card['suit'],string>={s:'♠',h:'♥',d:'♦',c:'♣'};
const RANK:Record<number,string>={10:'T',11:'J',12:'Q',13:'K',14:'A'};
const bb=(chips:number)=>Math.round(chips/TRAINER_BB*10)/10;
const STREET_TEXT=['プリフロップ','フロップ','ターン','リバー'];
/** Seat spots around the oval, clockwise from the hero at the bottom. */
const SPOTS=[{x:50,y:86},{x:11,y:68},{x:11,y:26},{x:50,y:9},{x:89,y:26},{x:89,y:68}];
const STATS_KEY='poker-gto-trainer-stats';
type Feedback={street:string;played:string;level:TrainerLevel|null;score:number|null;freq:number|null;evLoss:number|null;options:{text:string;freq:number}[];note?:string};
/** evLoss / evCount: EV lost on the decisions that have EVs (preflop chart), in big blinds. */
type Stats={hands:number;decisions:number;score:number;net:number;evLoss:number;evCount:number;levels:Record<TrainerLevel,number>};
const emptyStats=():Stats=>({hands:0,decisions:0,score:0,net:0,evLoss:0,evCount:0,levels:{best:0,correct:0,inaccurate:0,mistake:0,blunder:0}});
function readStats():Stats{try{const v=JSON.parse(window.localStorage.getItem(STATS_KEY)??'null');return v&&typeof v.hands==='number'&&v.levels?{...emptyStats(),...v,levels:{...emptyStats().levels,...v.levels}}:emptyStats();}catch{return emptyStats();}}
function writeStats(s:Stats){try{window.localStorage.setItem(STATS_KEY,JSON.stringify(s));}catch{/* convenience only */}}

export function CardChip({card,hidden}:{card?:Card;hidden?:boolean}){
 if(hidden||!card)return <span className={styles.card} data-back aria-label="伏せたカード"/>;
 return <span className={styles.card} data-red={card.suit==='h'||card.suit==='d'||undefined}>{RANK[card.rank]??card.rank}<small>{SUIT[card.suit]}</small></span>;
}
export const actText=(type:string,to:number,allIn:boolean)=>type==='fold'?'フォールド':type==='check'?'チェック':type==='call'?'コール':`${type==='bet'?'ベット':'レイズ'} ${bb(to)}${allIn?'（オールイン）':''}`;

/** Basic buttons when GTO has no answer for this spot (graded as 採点なし). */
function basicMenu(h:TrainerHand){
 const v=trainerView(h,HERO);if(!v)return [];
 const L=v.legal,out:{text:string;kind:string;label:string;to:number|null;freq:number}[]=[];
 if(!L.check)out.push({text:'フォールド',kind:'fold',label:'',to:null,freq:0});
 out.push(L.check?{text:'チェック',kind:'check',label:'',to:null,freq:0}:{text:'コール',kind:'call',label:'',to:null,freq:0});
 if(L.raise&&L.minRaiseTo!==null&&L.maxRaiseTo!==null){
  const pot=v.players.reduce((s,p)=>s+p.totalCommitted,0),me=v.players.find(p=>p.id===HERO)!,cur=Math.max(...v.players.map(p=>p.committed));
  const potTo=Math.min(L.maxRaiseTo,Math.max(L.minRaiseTo,cur+pot+(cur-me.committed)));
  const kind=cur===0?'bet':'raise';
  if(potTo<L.maxRaiseTo)out.push({text:`${kind==='bet'?'ベット':'レイズ'} ${bb(potTo)}BB`,kind,label:'',to:potTo,freq:0});
  out.push({text:'オールイン',kind:'allin',label:'',to:null,freq:0});
 }
 return out;
}

/** The hero folded: the rest of the hand doesn't matter for practice, so it ends here (as in GTO Wizard). */
const heroOut=(h:TrainerHand)=>!h.result&&Boolean(h.round.players.find(p=>p.id===HERO)?.folded);
const heroNet=(h:TrainerHand)=>h.result?netBB(h,HERO):-bb(h.round.players.find(p=>p.id===HERO)!.totalCommitted);

/** Two ways to practise (2026/10/31): a whole hand against GTO, or プリフロップ連打 (preflop decisions one after another). */
export function GtoTrainer({standard=false,upsell=false}:{standard?:boolean;upsell?:boolean}={}){
 const [kind,setKind]=useState<'hand'|'drill'>('hand');
 return <div className={styles.trainer}>
  <div className={styles.kinds} role="tablist" aria-label="練習の形">
   <button type="button" role="tab" aria-selected={kind==='hand'} onClick={()=>setKind('hand')}>1ハンド通して打つ</button>
   <button type="button" role="tab" aria-selected={kind==='drill'} onClick={()=>setKind('drill')}>プリフロップ連打</button>
  </div>
  {kind==='hand'?<GtoHandTrainer/>:<PreflopDrill weak={standard} upsell={upsell}/>}
 </div>;
}
function GtoHandTrainer(){
 const [handNo,setHandNo]=useState(0),[hand,setHand]=useState<TrainerHand|null>(null);
 const [spot,setSpot]=useState<TrainerSpot|'loading'|null>(null),[feedback,setFeedback]=useState<Feedback[]>([]);
 const [stats,setStats]=useState<Stats>(emptyStats),[speed,setSpeed]=useState<'normal'|'fast'>('normal'),[error,setError]=useState('');
 const [mode,setMode]=useState<TrainerMode>('all'),[seeking,setSeeking]=useState(false),startRef=useRef<TrainerHand|null>(null);
 const worker=useRef<Worker|null>(null),seq=useRef(0),counted=useRef<number|null>(null);
 useEffect(()=>{setStats(readStats());return()=>worker.current?.terminate();},[]);
 const ask=useCallback(async(build:(id:number)=>GtoRequest):Promise<GtoReply>=>{
  if(!worker.current){const {createGtoWorker}=await import('@/app/poker-demo/gto-worker-client');worker.current=createGtoWorker();}
  const w=worker.current,id=++seq.current;
  return new Promise<GtoReply>(resolve=>{const guard=window.setTimeout(()=>{w.removeEventListener('message',on);resolve({type:'error',id,message:'timeout'});},30000);
   const on=(e:MessageEvent<GtoReply>)=>{if(e.data.id!==id)return;window.clearTimeout(guard);w.removeEventListener('message',on);resolve(e.data);};
   w.addEventListener('message',on);w.postMessage(build(id));});
 },[]);
 const begin=(h:TrainerHand)=>{startRef.current=h;setHand(h);setFeedback([]);setSpot(null);setError('');counted.current=null;};
 // 練習の始め方: everyone (the hero too) plays GTO in the worker until the hero reaches the chosen spot; seats where the
 // spot cannot happen (e.g. BB for an open) are skipped, so the seat still moves round the table.
 const deal=async(n:number,seed:number)=>{
  if(mode==='all'){setHandNo(n);begin(startTrainerHand(seed,buttonIndexFor(n)));return;}
  let k=n;for(let i=0;i<6&&!MODE_POSITIONS[mode].includes(startTrainerHand(1,buttonIndexFor(k)).heroPos);i++)k++;
  setHandNo(k);setSeeking(true);setError('');
  const r=await ask(id=>({type:'trainerStart',id,mode,seed,buttonIndex:buttonIndexFor(k),tries:40}));
  setSeeking(false);
  if(r.type==='trainerStart'&&r.hand)begin(r.hand);else setError('この場面になる配牌が見つかりませんでした。もう一度押してください。');
 };
 const nextHand=()=>{void deal(hand?handNo+1:handNo,Math.floor(Math.random()*2**31));};
 const replay=()=>{if(startRef.current)begin(startRef.current);};

 // CPU turns: the GTO bot decides in the worker; a short pause so the action can be followed.
 useEffect(()=>{
  if(!hand||hand.result||heroOut(hand)||hand.round.toAct===HERO||!hand.round.toAct)return;
  const id=hand.round.toAct,view=trainerView(hand,id);if(!view)return;
  let live=true;
  const timer=window.setTimeout(async()=>{
   const reply=await ask(rid=>({type:'decide',id:rid,view,budgetMs:2500}));
   if(!live)return;
   let action:BettingAction=reply.type==='decision'?reply.decision.action:view.legal.check?{type:'check'}:{type:'fold'};
   try{setHand(h=>h===hand?trainerAct(hand,id,action):h);}
   catch{action=view.legal.check?{type:'check'}:{type:'fold'};setHand(h=>h===hand?trainerAct(hand,id,action):h);}
  },speed==='fast'?150:650);
  return ()=>{live=false;window.clearTimeout(timer);};
 },[hand,ask,speed]);

 // Hero's turn: fetch the GTO menu for this hand (the buttons are its options).
 useEffect(()=>{
  if(!hand||hand.result||hand.round.toAct!==HERO){setSpot(null);return;}
  const view=trainerView(hand,HERO);if(!view)return;
  let live=true;setSpot('loading');
  void ask(rid=>({type:'spot',id:rid,view,budgetMs:2500})).then(r=>{if(!live)return;
   if(r.type==='spot')setSpot(r.spot);else{setSpot({source:'none',reason:'error'});setError('GTOの計算に失敗しました。基本のボタンで続けられます（採点なし）。');}});
  return ()=>{live=false;};
 },[hand,ask]);

 // Hand over: add to the session record once.
 useEffect(()=>{
  if(!hand||!(hand.result||heroOut(hand))||counted.current===hand.seed)return;counted.current=hand.seed;
  setStats(s=>{const n={...s,hands:s.hands+1,net:Math.round((s.net+heroNet(hand))*10)/10};writeStats(n);return n;});
 },[hand]);

 const choose=(i:number)=>{
  if(!hand||!spot||spot==='loading')return;
  const view=trainerView(hand,HERO);if(!view)return;
  // 4人以上のポットは近似値: GTO's menu and shares are shown, but not graded.
  const known=spot.source!=='none',graded=known&&!spot.approx;
  const menu=known?spot.options:basicMenu(hand),o=menu[i];if(!o)return;
  const action=toTable(view,o.kind,o.label,o.to);
  let next:TrainerHand;try{next=trainerAct(hand,HERO,action);}catch{return;}
  const played=next.log[next.log.length-1];
  const fb:Feedback={street:STREET_TEXT[hand.street],played:actText(played.type,played.to,played.allIn),level:null,score:null,freq:null,evLoss:null,
   options:known?menu.filter(x=>x.freq>=0.005).sort((a,b)=>b.freq-a.freq).map(x=>({text:x.text,freq:x.freq})):[],
   note:!known?`採点なし：${reasonText(spot.reason)}`:spot.approx?'近似値：4人以上のポットや計算待ちの場面のため、その場の簡易計算です。GTOの割合は目安です（採点なし）':spot.nearFlop?`近いフロップ（${spot.nearFlop}）の計算で判定`:undefined};
  if(graded){// GTO's most frequent choice counts as no loss (the chart's EVs are within a few hundredths of a BB there, rarely more).
   const g=gradeChoice(menu.map(x=>x.freq),i),raw=evLoss(menu,i),loss=raw===null?null:g.level==='best'?0:raw;fb.level=g.level;fb.score=g.score;fb.freq=g.freq;fb.evLoss=loss;
   sendGtoRecords([recordRow(view,'trainer',{freqs:menu.map(x=>x.freq),chosen:i,action:fb.played,evLoss:loss})]);
   setStats(s=>{const n={...s,decisions:s.decisions+1,score:s.score+g.score,levels:{...s.levels,[g.level]:s.levels[g.level]+1},
    ...(loss!==null?{evLoss:Math.round((s.evLoss+loss)*100)/100,evCount:s.evCount+1}:{})};writeStats(n);return n;});}
  setFeedback(f=>[...f,fb]);setSpot(null);setHand(next);
 };

 const resetStats=()=>{const s=emptyStats();setStats(s);writeStats(s);};
 const menu=hand&&spot&&spot!=='loading'?(spot.source==='none'?basicMenu(hand):spot.options):[];
 const heroIdx=0,board=hand?visibleBoard(hand):[],pot=hand?hand.round.players.reduce((s,p)=>s+p.totalCommitted,0):0;
 const formBox=<>
  <div className={`${chart.form} ${styles.formBig} ${styles.settings}`}>
   <label>練習の始め方<select value={mode} onChange={e=>setMode(e.target.value as TrainerMode)}>{(Object.keys(MODE_TEXT) as TrainerMode[]).map(m=><option key={m} value={m}>{MODE_TEXT[m]}</option>)}</select></label>
   <label>CPUの速さ<select value={speed} onChange={e=>setSpeed(e.target.value as 'normal'|'fast')}><option value="normal">ふつう</option><option value="fast">はやい</option></select></label>
   {!hand&&<button type="button" disabled={seeking} onClick={nextHand}>対戦を始める</button>}
   {seeking&&<p role="status">場面を探しています…</p>}
  </div>
 </>;
 const statsBox=<>
  <section className={styles.stats} aria-label="練習の成績">
   <p><b>成績</b><span>ハンド {stats.hands}</span><span>採点 {stats.decisions}回</span><span>平均スコア {stats.decisions?Math.round(stats.score/stats.decisions):0}点</span><span>収支 {stats.net>0?'+':''}{stats.net}BB</span>{stats.evCount>0&&<span>EV損失 平均 {(stats.evLoss/stats.evCount).toFixed(2)}BB（{stats.evCount}回）</span>}</p>
   <ul>{TRAINER_LEVELS.map(l=><li key={l} data-level={l}><b>{LEVEL_TEXT[l]}</b>{stats.levels[l]}</li>)}</ul>
   <button type="button" className={styles.reset} onClick={resetStats}>成績をリセット</button>
  </section>
 </>;
 const last=feedback[feedback.length-1],done=Boolean(hand&&(hand.result||heroOut(hand)));
 return <div className={chart.wrap}>
  {!hand&&<p className={styles.introShort}>GTOで打つCPU5人と1ハンドずつ対戦。自分が打つたびに採点します。</p>}
  {!hand&&<p className={styles.intro}>GTOで打つCPU5人と6人卓で1ハンドずつ打ちます。自分のカードは表向き、座る場所は1ハンドごとに1つずつ動きます（BTN→CO→HJ→UTG→BB→SB）。自分が打つたびに、その手でGTOがその打ち方をどれくらい選ぶかで採点します。スタックは毎ハンド全員100BBです。</p>}
  {!hand&&formBox}
  {hand&&<div className={styles.play} data-hide-back-to-top>
   <div className={styles.table} role="group" aria-label={`練習卓・あなたは${hand.heroPos}`}>
    <div className={styles.felt}>
     <div className={styles.center}><span className={styles.pot}>ポット {bb(pot)}BB</span><div className={styles.board}>{board.map((c,i)=><CardChip key={i} card={c}/>)}</div>{done&&<strong className={styles.result}>{heroNet(hand)>0?`+${heroNet(hand)}`:heroNet(hand)}BB</strong>}</div>
    </div>
    {TRAINER_SEATS.map((id,k)=>{const p=hand.round.players.find(x=>x.id===id)!,spotXY=SPOTS[(k-heroIdx+6)%6],me=id===HERO,show=me||done;
     const won=hand.result?.winners.includes(id);
     return <div key={id} className={styles.seat} style={{left:`${spotXY.x}%`,top:`${spotXY.y}%`}} data-hero={me||undefined} data-folded={p.folded||undefined} data-turn={!done&&hand.round.toAct===id||undefined} data-won={won||undefined}>
      <div className={styles.cards}><CardChip card={hand.holes[id][0]} hidden={!show}/><CardChip card={hand.holes[id][1]} hidden={!show}/></div>
      <span className={styles.badge}>{hand.positions[id]}{hand.button===id&&<i aria-label="ボタン">D</i>}</span>
      <span className={styles.stack}>{me?'あなた':'GTO'} {bb(p.stack)}BB</span>
      {p.committed>0&&!done&&<span className={styles.bet}>{bb(p.committed)}</span>}
     </div>;})}
   </div>
   <div className={styles.playSide}>
   {formBox}
   <ol className={styles.log} aria-label="このハンドのアクション">{hand.log.map((a,i)=><li key={i} data-hero={a.id===HERO||undefined}><b>{hand.positions[a.id]}</b>{actText(a.type,a.to,a.allIn)}</li>)}{!done&&hand.round.toAct&&<li data-turn><b>{hand.positions[hand.round.toAct]}</b>{hand.round.toAct===HERO?'あなたの番':'考え中…'}</li>}</ol>
   {!done&&hand.round.toAct===HERO&&<div className={styles.actions}>
    {spot==='loading'&&<p role="status">GTOを計算中…</p>}
    {menu.map((o,i)=><button key={i} type="button" data-kind={o.kind} onClick={()=>choose(i)}>{o.text}</button>)}
   </div>}
   {error&&<p role="alert">{error}</p>}
   {last&&<section className={styles.feedback} aria-live="polite" data-level={last.level??'none'}>
    <p><b>{last.level?LEVEL_TEXT[last.level]:'採点なし'}</b>{last.score!==null&&<span>スコア {last.score}点</span>}{last.evLoss!==null&&<span>{last.evLoss>0?`EV損失 ${last.evLoss.toFixed(2)}BB`:'EV損失なし'}</span>}<small>{last.street}：{last.played}{last.freq!==null&&`（GTOがこの手で選ぶ割合 ${Math.round(last.freq*100)}%）`}</small></p>
    {last.options.length>0&&<p className={chart.note}>GTO：{last.options.map(o=>`${o.text} ${Math.round(o.freq*100)}%`).join('・')}</p>}
    {last.note&&<p className={chart.note}>{last.note}</p>}
   </section>}
   {done&&<div className={`${chart.form} ${styles.formBig}`}>
    <button type="button" disabled={seeking} onClick={nextHand}>次のハンド</button>
    <button type="button" onClick={replay}>同じハンドをやり直す</button>
   </div>}
   {done&&feedback.length>0&&<ol className={styles.history} aria-label="このハンドの採点">{feedback.map((f,i)=><li key={i} data-level={f.level??'none'}><b>{f.level?LEVEL_TEXT[f.level]:'採点なし'}</b>{f.street}：{f.played}{f.evLoss!==null&&`（EV損失 ${f.evLoss.toFixed(2)}BB）`}{f.options.length>0&&<small>GTO：{f.options.map(o=>`${o.text} ${Math.round(o.freq*100)}%`).join('・')}</small>}</li>)}</ol>}
   {statsBox}
   </div>
  </div>}
  {!hand&&statsBox}
  {(!hand||done)&&stats.hands>=3&&<StoreInvite/>}
  <details className={styles.rules}><summary>採点の決め方</summary><p className={chart.note}>採点はGTOの頻度で判定します（いちばん多い打ち方＝◎完璧、25%以上＝○良い、8%以上＝△惜しい、2%以上＝×ミス、それ未満＝××大きなミス）。ターン・リバーはその場で計算するため数秒かかります。4人以上のポットや計算待ちの場面は、その場の簡易計算による近似値（採点なし）です。EV損失は、その手でいちばん得な打ち方と比べて失ったチップの見込み（BB）です。プリフロップとターン・リバーの判断に出ます（フロップは計算データがそろってから。ターンはその場の計算が十分に詰められたときだけ）。成績はこのブラウザに保存されます。</p></details>
 </div>;
}
