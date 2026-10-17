'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {PokerPlayerClient,PlayerClientError,type PlayerSnapshot} from '@/lib/poker/player-client';
import {OnlineControls} from './online-controls';
import {OnlineTableView} from './online-table-view';
export {OnlineTableView} from './online-table-view';
import shared from '../../poker-demo/poker-table.module.css';
export default function OnlineTable({roomId,enabled,eventsOrigin}:{roomId:string;enabled:boolean;eventsOrigin?:string}){
 const client=useRef<PokerPlayerClient|null>(null),busyRef=useRef(false),pollMode=useRef<'spectator'|'player'|null>(null);
 const [state,setState]=useState<PlayerSnapshot|null>(null),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[message,setMessage]=useState('参加ボタンから接続してください。'),[connectionEpoch,setConnectionEpoch]=useState(0),[exitOpen,setExitOpen]=useState(false);
 async function run(operation:(c:PokerPlayerClient)=>Promise<unknown>){
  const c=client.current;if(!c||busyRef.current)return;busyRef.current=true;setBusy(true);
  try{await operation(c);if(client.current===c){setState(c.state);setMessage(c.pending?'前の操作の結果確認が必要です。':'接続中');}}
  catch(error){if(client.current===c){setState(null);pollMode.current=null;setMessage(error instanceof PlayerClientError&&error.status===401?'ログインを確認してください。':error instanceof PlayerClientError&&error.status===409?'接続が切り替わったか、ゲームが進みました。再接続してください。':'接続を確認できません。しばらくしてから再接続してください。');}}
  finally{if(client.current===c){busyRef.current=false;setBusy(false);setPending(c.pending);}}
 }
 useEffect(()=>{
  setState(null);setPending(false);setBusy(false);setConnectionEpoch(0);pollMode.current=null;busyRef.current=false;
  if(!enabled)return;
  const supabase=createClient();const c=new PokerPlayerClient({endpoint:`/api/poker/rooms/${roomId}`,token:async()=>{const {data:{session}}=await supabase.auth.getSession();return session?.access_token??null;}});client.current=c;
  // Session data supplies a credential only; the service re-verifies identity and admission.
  let userId:string|undefined;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||userId!==undefined&&userId!==(session?.user.id??'')){c.close();client.current=null;pollMode.current=null;setState(null);setPending(false);setBusy(false);busyRef.current=false;setConnectionEpoch(0);setMessage('ログイン状態が変わりました。ページを再読み込みしてください。');}userId=session?.user.id??'';});
  const timer=setInterval(()=>{if(pollMode.current&&!busyRef.current&&!c.pending)void run(x=>pollMode.current==='player'?x.refresh():x.spectate());},1000);
  return()=>{clearInterval(timer);subscription.unsubscribe();c.close();if(client.current===c)client.current=null;busyRef.current=false;};
 },[roomId,enabled]);
 useEffect(()=>{
  const c=client.current;if(!c||!eventsOrigin||connectionEpoch===0)return;
  let cancelled=false,stop:(()=>void)|undefined;
  void c.watch(eventsOrigin,()=>{if(!cancelled&&pollMode.current==='player'&&!busyRef.current&&!c.pending)void run(x=>x.refresh());},()=>{if(cancelled)return;pollMode.current=null;setState(null);setMessage('リアルタイム接続が切れました。再接続してください。');}).then(cleanup=>{if(cancelled)cleanup();else stop=cleanup;}).catch(()=>{if(!cancelled){pollMode.current=null;setState(null);setMessage('リアルタイム接続を開始できません。再接続してください。');}});
  return()=>{cancelled=true;stop?.();};
 },[eventsOrigin,connectionEpoch]);
 return <><OnlineTableView state={state} onExit={()=>setExitOpen(true)}>
  <OnlineControls state={state} busy={busy} pending={pending} enabled={enabled} message={message}
   onJoin={()=>void run(async c=>{await c.join();pollMode.current='player';setConnectionEpoch(v=>v+1);})}
   onSpectate={()=>void run(async c=>{if(c.state?.youSeat!=null)await c.disconnect();await c.spectate();pollMode.current='spectator';setConnectionEpoch(0);})}
   onRetry={()=>void run(async c=>{await c.retry();pollMode.current='player';})}
   onAct={action=>void run(c=>c.act(action))}/>
  </OnlineTableView>
  {exitOpen&&<div className={shared.seatOverlay}><div className={shared.seatDialog} role="dialog" aria-modal="true" aria-labelledby="online-exit-title"><h2 id="online-exit-title">ゲームを退出しますか？</h2><p>退出しても大会のチップや進行は維持されます。</p>{pending&&<p>先に前の操作の結果を確認してください。</p>}<div className={shared.seatDialogActions}><button type="button" onClick={()=>setExitOpen(false)}>キャンセル</button><button type="button" disabled={busy||pending} onClick={()=>{if(!client.current||!state||state.youSeat===null){window.location.assign('/poker-lobby');return;}void run(async c=>{await c.disconnect();pollMode.current=null;window.location.assign('/poker-lobby');});}}>退出する</button></div></div></div>}
 </>;
}
