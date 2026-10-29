'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import styles from './hand-history.module.css';
import {HistoryCards,chips,handDate,handTitle} from './hand-history-list';
import type {HandHistoryView} from '@/lib/poker/hand-histories';
import type {HistoryAction} from '@/lib/poker/hand-history';
import {reviewDecisions,type DecisionReview} from '@/lib/poker/hand-review';
import {reasonText,verdictText,type GtoReview} from '@/lib/poker/gto-review';
import type {GtoReply,GtoRequest} from '@/lib/poker/gto.worker';
import {GtoRangeGrid} from './gto-range-grid';
import chartStyles from './gto-chart.module.css';

const verbs:Record<HistoryAction['type'],string>={ante:'アンティ',sb:'スモールブラインド',bb:'ビッグブラインド',fold:'フォールド',check:'チェック',call:'コール',bet:'ベット',raise:'レイズ'};
const streetNames={preflop:'プリフロップ',flop:'フロップ',turn:'ターン',river:'リバー'} as const;
const boardCount={preflop:0,flop:3,turn:4,river:5} as const;
const pct=(n:number)=>`${Math.round(n*100)}%`;
const noteText:Record<NonNullable<DecisionReview['note']>,string>={'fold-strong':'勝率は足りていた。降りすぎかも','fold-ok':'降りて妥当','call-thin':'勝率が足りない。コールしすぎかも','call-ok':'コールして妥当'};
/** One line per own decision: required equity (pot odds) vs estimated equity against random hands. */
export function reviewText(r:DecisionReview){
 const eq=`推定勝率 ${pct(r.equity)}`;
 return r.toCall>0?`必要勝率 ${pct(r.required)}・${eq}${r.note?`（${noteText[r.note]}）`:''}`:eq;
}
export function actionText(a:HistoryAction){
 const amount=a.type==='raise'?`${a.to.toLocaleString()}まで`:a.amount>0?a.amount.toLocaleString():'';
 return `${verbs[a.type]}${amount?` ${amount}`:''}${a.allIn?'（オールイン）':''}`;
}

/** GTO review runs in the GTO worker on demand (turn/river solves take a few seconds). */
function useGtoReview(hand:HandHistoryView){
 const [state,setState]=useState<{status:'idle'|'running'|'done'|'error';reviews:GtoReview[]}>({status:'idle',reviews:[]});
 const worker=useRef<Worker|null>(null);
 useEffect(()=>{setState({status:'idle',reviews:[]});return()=>{worker.current?.terminate();worker.current=null;};},[hand.handId]);
 const start=async()=>{
  setState({status:'running',reviews:[]});
  try{const {createGtoWorker}=await import('@/app/poker-demo/gto-worker-client');worker.current?.terminate();const w=createGtoWorker();worker.current=w;
   const guard=window.setTimeout(()=>{w.terminate();setState({status:'error',reviews:[]});},60000);
   w.onmessage=(e:MessageEvent<GtoReply>)=>{window.clearTimeout(guard);w.terminate();if(worker.current===w)worker.current=null;setState(e.data.type==='review'?{status:'done',reviews:e.data.reviews}:{status:'error',reviews:[]});};
   w.onerror=()=>{window.clearTimeout(guard);setState({status:'error',reviews:[]});};
   w.postMessage({type:'review',id:1,budgetMs:1500,hand:{handId:hand.handId,terms:hand.terms,buttonSeatId:hand.buttonSeatId,board:hand.board,actions:hand.actions,
    players:hand.players.map(p=>({seatId:p.seatId,seat:p.seat,startStack:p.startStack,you:p.you,hole:p.you?p.hole:null}))}} satisfies GtoRequest);
  }catch{setState({status:'error',reviews:[]});}
 };
 return {...state,start};
}
export function gtoText(r:GtoReview){
 if(r.source==='none')return `GTO：${reasonText(r.reason)}`;
 const opts=r.options.filter(o=>o.freq>=0.005).sort((a,b)=>b.freq-a.freq).map(o=>`${o.text} ${pct(o.freq)}`).join('・');
 return `GTO：${opts}${r.played===null?'（この打ち方は表にありません）':''}`;
}

/** Step through a finished hand. step 0 = forced bets posted, step N = hand finished. */
export function HandReplay({hand,shared=false}:{hand:HandHistoryView;shared?:boolean}){
 const forced=hand.actions.findIndex(a=>!['ante','sb','bb'].includes(a.type));
 const first=forced<0?hand.actions.length:forced,last=hand.actions.length;
 const [step,setStep]=useState(first),[rangeAt,setRangeAt]=useState<number|null>(null);
 const reviews=useMemo(()=>reviewDecisions(hand),[hand]);
 const reviewAt=new Map(reviews.map(r=>[r.index,r]));
 const gto=useGtoReview(hand),gtoAt=new Map(gto.reviews.map(r=>[r.index,r])),canGto=hand.players.some(p=>p.you&&p.hole?.length===2)&&hand.actions.some(a=>!['ante','sb','bb'].includes(a.type)&&hand.players.find(p=>p.seatId===a.seatId)?.you);
 const done=hand.actions.slice(0,step),current=step>0?hand.actions[step-1]:null,finished=step===last;
 const street=finished?'river':(current?.street??'preflop');
 const shownBoard=finished?hand.board:hand.board.slice(0,boardCount[street]);
 const pot=finished?0:(current?.pot??0);
 const name=(seatId:string)=>hand.players.find(p=>p.seatId===seatId)?.name??seatId;
 return <div className={styles.replay}>
  <div className={styles.head}><strong>{handTitle(hand)}{hand.handNumber?` #${hand.handNumber}`:''}</strong><span>{handDate(hand.playedAt)}（日本時間）</span><span>ブラインド {hand.terms.sb.toLocaleString()}/{hand.terms.bb.toLocaleString()}{hand.terms.ante?` · アンティ ${hand.terms.ante.toLocaleString()}`:''}</span></div>
  <div className={styles.felt}>
   <div className={styles.board}><small>{finished?'結果':streetNames[street]}</small><HistoryCards cards={shownBoard} count={0}/>{!shownBoard.length&&<span className={styles.empty} aria-hidden="true"/>}<b>{finished?'精算済み':`ポット ${pot.toLocaleString()}`}</b></div>
   <div className={styles.seats}>{hand.players.map(p=>{
    const paid=done.filter(a=>a.seatId===p.seatId).reduce((s,a)=>s+a.amount,0);
    const folded=done.some(a=>a.seatId===p.seatId&&a.type==='fold');
    const stack=finished?p.endStack:p.startStack-paid;
    return <div key={p.seatId} className={styles.seat} data-you={p.you} data-acting={!finished&&current?.seatId===p.seatId} data-folded={folded}>
     <span className={styles.badge}>{p.position}</span><span>{p.name}{p.you&&!shared?'（あなた）':''}</span>
     <HistoryCards cards={p.hole}/>
     <b>{stack.toLocaleString()}</b>
     {finished&&<small data-sign={p.net>0?'plus':p.net<0?'minus':undefined} className={styles.net}>{chips(p.net)}</small>}
    </div>;})}</div>
  </div>
  <div className={styles.controls} role="group" aria-label="再生操作">
   <button type="button" onClick={()=>setStep(first)} disabled={step===first}>最初</button>
   <button type="button" onClick={()=>setStep(s=>Math.max(first,s-1))} disabled={step===first}>前へ</button>
   <button type="button" onClick={()=>setStep(s=>Math.min(last,s+1))} disabled={finished}>次へ</button>
   <button type="button" onClick={()=>setStep(last)} disabled={finished}>最後</button>
   <span>{step-first} / {last-first}</span>
  </div>
  <div>{(['preflop','flop','turn','river'] as const).filter(s=>hand.actions.some(a=>a.street===s)).map(s=><section key={s} aria-label={streetNames[s]}>
   <p className={styles.street}>{streetNames[s]}</p>
   <ol className={styles.log}>{hand.actions.map((a,i)=>a.street!==s?null:<li key={i} data-current={i===step-1} data-future={i>=step}><em>{hand.players.find(p=>p.seatId===a.seatId)?.position}</em><span>{name(a.seatId)}：{actionText(a)}{reviewAt.has(i)&&<small className={styles.review} data-flag={reviewAt.get(i)!.note==='fold-strong'||reviewAt.get(i)!.note==='call-thin'}>{reviewText(reviewAt.get(i)!)}</small>}{gtoAt.has(i)&&(()=>{const g=gtoAt.get(i)!;return <small className={styles.gto}>{g.source!=='none'&&g.verdict&&<span className={styles.gtoBadge} data-verdict={g.verdict}>{verdictText[g.verdict]}{g.played!==null?` ${pct(g.played)}`:''}</span>}{gtoText(g)}{g.source!=='none'&&g.range&&<button type="button" className={chartStyles.rangeToggle} aria-expanded={rangeAt===i} onClick={()=>setRangeAt(rangeAt===i?null:i)}>{rangeAt===i?'レンジ表を閉じる':'レンジ表'}</button>}</small>;})()}{rangeAt===i&&(()=>{const g=gtoAt.get(i);return g&&g.source!=='none'&&g.range?<GtoRangeGrid range={g.range} who={shared?'投稿者':'あなた'}/>:null;})()}</span></li>)}</ol>
  </section>)}</div>
  {canGto&&<div className={styles.gtoBar}>{gto.status==='idle'&&<button type="button" onClick={gto.start}>GTOで振り返る</button>}{gto.status==='running'&&<span role="status">GTOを計算中…（数秒かかります）</span>}{gto.status==='error'&&<><span role="alert">GTOの計算に失敗しました。</span><button type="button" onClick={gto.start}>もう一度</button></>}{gto.status==='done'&&<span role="status">{(()=>{const judged=gto.reviews.filter(r=>r.source!=='none'&&r.verdict);return judged.length?`${shared?'投稿者':'あなた'}の判断 ${judged.length}回：GTO通り ${judged.filter(r=>r.source!=='none'&&r.verdict==='gto').length}・ときどき ${judged.filter(r=>r.source!=='none'&&r.verdict==='mixed').length}・ほぼやらない ${judged.filter(r=>r.source!=='none'&&r.verdict==='rare').length}`:'このハンドはGTOの計算範囲外でした。';})()}</span>}</div>}
  {reviews.length>0&&<div className={styles.result}><p className={styles.street}>振り返り</p>
   {reviews.some(r=>r.note==='fold-strong'||r.note==='call-thin')?<ul className={styles.log}>{reviews.filter(r=>r.note==='fold-strong'||r.note==='call-thin').map(r=><li key={r.index}><em>{streetNames[r.street]}</em><span>{actionText(hand.actions[r.index])}：{reviewText(r)}</span></li>)}</ul>:<p>このハンドで目立って損な判断は見つかりませんでした。</p>}
   <p>※推定勝率は、残っている相手の手札をランダムと仮定した目安です。相手がレイズしている場面では、実際の勝率はこれより低くなることがあります。</p></div>}
  {finished&&<div className={styles.result}><p>{hand.result.showdown?'ショーダウン':'ショーダウンなし'} · 勝者：{hand.result.winners.map(name).join('・')}（{hand.result.winners.map(w=>(hand.result.payouts[w]??0).toLocaleString()).join('・')}）</p>{hand.result.runs&&<ul className={styles.log} aria-label="ラン・イット・トゥワイス">{hand.result.runs.map((r,i)=><li key={i}><em>{i+1}回目</em><span><HistoryCards cards={r.board} count={0}/> 勝者：{r.winners.map(name).join('・')}（ポットの半分）</span></li>)}</ul>}</div>}
 </div>;
}
