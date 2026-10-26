'use client';
import {useMemo,useState} from 'react';
import styles from './hand-history.module.css';
import {HistoryCards,chips,handDate,handTitle} from './hand-history-list';
import type {HandHistoryView} from '@/lib/poker/hand-histories';
import type {HistoryAction} from '@/lib/poker/hand-history';
import {reviewDecisions,type DecisionReview} from '@/lib/poker/hand-review';

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

/** Step through a finished hand. step 0 = forced bets posted, step N = hand finished. */
export function HandReplay({hand}:{hand:HandHistoryView}){
 const forced=hand.actions.findIndex(a=>!['ante','sb','bb'].includes(a.type));
 const first=forced<0?hand.actions.length:forced,last=hand.actions.length;
 const [step,setStep]=useState(first);
 const reviews=useMemo(()=>reviewDecisions(hand),[hand]);
 const reviewAt=new Map(reviews.map(r=>[r.index,r]));
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
     <span className={styles.badge}>{p.position}</span><span>{p.name}{p.you?'（あなた）':''}</span>
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
   <ol className={styles.log}>{hand.actions.map((a,i)=>a.street!==s?null:<li key={i} data-current={i===step-1} data-future={i>=step}><em>{hand.players.find(p=>p.seatId===a.seatId)?.position}</em><span>{name(a.seatId)}：{actionText(a)}{reviewAt.has(i)&&<small className={styles.review} data-flag={reviewAt.get(i)!.note==='fold-strong'||reviewAt.get(i)!.note==='call-thin'}>{reviewText(reviewAt.get(i)!)}</small>}</span></li>)}</ol>
  </section>)}</div>
  {reviews.length>0&&<div className={styles.result}><p className={styles.street}>振り返り</p>
   {reviews.some(r=>r.note==='fold-strong'||r.note==='call-thin')?<ul className={styles.log}>{reviews.filter(r=>r.note==='fold-strong'||r.note==='call-thin').map(r=><li key={r.index}><em>{streetNames[r.street]}</em><span>{actionText(hand.actions[r.index])}：{reviewText(r)}</span></li>)}</ul>:<p>このハンドで目立って損な判断は見つかりませんでした。</p>}
   <p>※推定勝率は、残っている相手の手札をランダムと仮定した目安です。相手がレイズしている場面では、実際の勝率はこれより低くなることがあります。</p></div>}
  {finished&&<div className={styles.result}><p>{hand.result.showdown?'ショーダウン':'ショーダウンなし'} · 勝者：{hand.result.winners.map(name).join('・')}（{hand.result.winners.map(w=>(hand.result.payouts[w]??0).toLocaleString()).join('・')}）</p></div>}
 </div>;
}
