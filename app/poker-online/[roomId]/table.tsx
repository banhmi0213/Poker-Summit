'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {PokerPlayerClient,PlayerClientError,type PlayerSnapshot} from '@/lib/poker/player-client';
import {cardLabel} from '@/lib/poker/card-display';
import type {Card} from '@/lib/poker/engine';
import styles from './table.module.css';
export function OnlineTableView({state}:{state:PlayerSnapshot|null}){
 const hand=state?.hand;
 const cards=(values:readonly Card[]|null)=>values?.map((card,i)=><span className={styles.card} key={i}>{cardLabel(card)}</span>)??<><span className={styles.card}>裏</span><span className={styles.card}>裏</span></>;
 return <>
  <div className={styles.timer}>{state?`LEVEL ${state.clock.level} · ${state.clock.phase==='break'?'休憩':state.clock.phase==='final'?'最終レベル継続':state.clock.phase==='scheduled'?'開始待ち':`${state.clock.remaining}秒`}`:'未接続'}{hand&&` · SB ${hand.terms.sb} / BB ${hand.terms.bb} / ANTE ${hand.terms.ante}`}</div>
  <section className={styles.table} aria-label="サーバーのテーブル状態">
   <div className={styles.board}><strong>POT {hand?.pot??0}</strong><div>{hand?cards(hand.board):'参加者の接続を待っています'}</div>{hand&&<small>ハンド {state?.handNumber} · {hand.street}</small>}</div>
   <div className={styles.seats}>{state?.seats.filter(s=>s.occupied).map(seat=>{
    const player=hand?.players.find(p=>p.id===seat.id);
    const positions=hand?(['button','sb','bb'] as const).filter(p=>hand.positions[p]===seat.id).map(p=>p==='button'?'BTN':p.toUpperCase()).join(' / '):'';
    return <article key={seat.id} className={styles.seat} data-active={hand?.toAct===seat.id}>
     <strong>プレイヤー {seat.seat}{state.youSeat===seat.seat?'（あなた）':''}</strong><small>{positions} · {seat.connected?'接続中':'未接続'}</small>
     {player?<><div className={styles.cards}>{cards(player.hole)}</div><div>チップ {player.stack} · ベット {hand?.result?0:player.committed}</div><small>{player.folded?'フォールド':player.allIn?'オールイン':hand?.toAct===seat.id?'アクション待ち':''}</small>{hand?.result&&<div>獲得 {hand.result.payouts[seat.id]??0}</div>}</>:<p>開始待ち</p>}
    </article>;
   })}</div>
  </section>
  {state?.phase==='finished'&&<p role="status">大会終了 · 優勝 プレイヤー {state.tournament?.champion?.replace('seat-','')} <a href="/poker-lobby">退出する</a></p>}
 </>;
}
export default function OnlineTable({roomId,enabled,eventsOrigin}:{roomId:string;enabled:boolean;eventsOrigin?:string}){
 const client=useRef<PokerPlayerClient|null>(null),busyRef=useRef(false),pollMode=useRef<'spectator'|'player'|null>(null);
 const [state,setState]=useState<PlayerSnapshot|null>(null),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[message,setMessage]=useState('接続確認用の画面です。'),[amount,setAmount]=useState(''),[connectionEpoch,setConnectionEpoch]=useState(0);
 async function run(operation:(c:PokerPlayerClient)=>Promise<unknown>){
  const c=client.current;if(!c||busyRef.current)return;busyRef.current=true;setBusy(true);
  try{await operation(c);if(client.current===c){setState(c.state);setMessage(c.pending?'前の操作の結果確認が必要です。':'接続中');}}
  catch(error){if(client.current===c){setState(null);pollMode.current=null;setMessage(error instanceof PlayerClientError&&error.status===401?'ログインを確認してください。':error instanceof PlayerClientError&&error.status===409?'接続が切り替わったか、ゲームが進みました。再接続してください。':'接続を確認できません。しばらくしてから再接続してください。');}}
  finally{if(client.current===c){busyRef.current=false;setBusy(false);setPending(c.pending);}}
 }
 useEffect(()=>{
  if(!enabled)return;
  const supabase=createClient();const c=new PokerPlayerClient({endpoint:`/api/poker/rooms/${roomId}`,token:async()=>{const {data:{session}}=await supabase.auth.getSession();return session?.access_token??null;}});client.current=c;
  // Session data supplies a credential only; the service re-verifies identity and admission.
  let userId:string|undefined;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(userId!==undefined&&userId!==(session?.user.id??'')){c.close();client.current=null;pollMode.current=null;setState(null);setMessage('ログイン状態が変わりました。ページを再読み込みしてください。');}userId=session?.user.id??'';});
  const timer=setInterval(()=>{if(pollMode.current&&!busyRef.current&&!c.pending)void run(x=>pollMode.current==='player'?x.refresh():x.spectate());},1000);
  return()=>{clearInterval(timer);subscription.unsubscribe();c.close();if(client.current===c)client.current=null;busyRef.current=false;};
 },[roomId,enabled]);
 useEffect(()=>{
  const c=client.current;if(!c||!eventsOrigin||connectionEpoch===0)return;
  let cancelled=false,stop:(()=>void)|undefined;
  void c.watch(eventsOrigin,()=>{if(!cancelled&&pollMode.current==='player'&&!busyRef.current&&!c.pending)void run(x=>x.refresh());},()=>{if(cancelled)return;pollMode.current=null;setState(null);setMessage('リアルタイム接続が切れました。再接続してください。');}).then(cleanup=>{if(cancelled)cleanup();else stop=cleanup;}).catch(()=>{if(!cancelled){pollMode.current=null;setState(null);setMessage('リアルタイム接続を開始できません。再接続してください。');}});
  return()=>{cancelled=true;stop?.();};
 },[eventsOrigin,connectionEpoch]);
 useEffect(()=>setAmount(''),[state?.hand?.handId,state?.hand?.revision]);
 const legal=state?.hand?.legal,locked=busy||pending||!enabled;
 const wager=Number(amount||legal?.minRaiseTo),validWager=Number.isSafeInteger(wager)&&legal?.minRaiseTo!=null&&legal.maxRaiseTo!=null&&wager>=legal.minRaiseTo&&wager<=legal.maxRaiseTo;
 return <main className={styles.page}>
  <header><a href="/">Poker Summit</a><a href="/poker-lobby">ロビーへ戻る</a></header>
  <h1>オンライン対戦 接続確認</h1>
  {!enabled&&<p role="status">オンライン対戦サーバーはまだ公開していません。現在のデモはロビーから利用できます。</p>}
  <p role="status">{message}</p>
  <div className={styles.controls}>
   <button disabled={busy||!enabled} onClick={()=>void run(async c=>{await c.connect();pollMode.current='player';setConnectionEpoch(v=>v+1);})}>接続・再接続</button>
   <button disabled={locked} onClick={()=>void run(async c=>{await c.spectate();pollMode.current='spectator';})}>観戦</button>
   {[1,2,3,4,5,6].map(seat=><button key={seat} disabled={locked||state?.seats.some(s=>s.seat===seat&&s.occupied)} onClick={()=>void run(async c=>{await c.seat(seat);await c.connect();pollMode.current='player';setConnectionEpoch(v=>v+1);})}>{seat}番席に着席</button>)}
   {pending&&<button disabled={busy} onClick={()=>void run(async c=>{await c.retry();pollMode.current='player';})}>前の操作の結果を確認</button>}
  </div>
  <OnlineTableView state={state}/>
  <div className={styles.controls} aria-label="アクション">
   <button disabled={locked||!legal?.fold} onClick={()=>void run(c=>c.act({type:'fold'}))}>フォールド</button>
   <button disabled={locked||!legal?.check} onClick={()=>void run(c=>c.act({type:'check'}))}>チェック</button>
   <button disabled={locked||!legal?.call} onClick={()=>void run(c=>c.act({type:'call'}))}>コール {legal?.callAmount??0}</button>
   <label>ベット後の合計 <input aria-label="ベット後の合計" type="number" inputMode="numeric" min={legal?.minRaiseTo??0} max={legal?.maxRaiseTo??0} value={amount||legal?.minRaiseTo||''} onChange={e=>setAmount(e.target.value)} disabled={locked||!legal?.raise}/></label>
   <button disabled={locked||!legal?.raise||!validWager} onClick={()=>void run(c=>c.act({type:state?.hand?.players.some(p=>!p.folded&&p.committed>0)?'raise':'bet',amount:wager}))}>{legal?.shortAllInOnly?'オールイン':'ベット・レイズ'}</button>
  </div>
  <p>{eventsOrigin?'更新通知を即時に受信し、1秒間隔でも状態を確認します。':'通信は1秒間隔で更新します。'}操作結果が不明な間は新しいベットを停止します。</p>
 </main>;
}
