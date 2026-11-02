'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useSoundSettings} from '@/lib/poker/sound-settings';
import {createClient} from '@/lib/supabase/client';
import {PokerPlayerClient,PlayerClientError,type PlayerSnapshot} from '@/lib/poker/player-client';
import {PokerSounds,type PokerSound} from '@/lib/poker/online-sounds';
import {OnlineControls} from './online-controls';
import {OnlineTableView} from './online-table-view';
export {OnlineTableView} from './online-table-view';
import shared from '../../poker-demo/poker-table.module.css';
export default function OnlineTable({roomId,enabled,eventsOrigin}:{roomId:string;enabled:boolean;eventsOrigin?:string}){
 const audio=useRef<PokerSounds|null>(null),navigationTimer=useRef<ReturnType<typeof setTimeout>|null>(null),navigating=useRef(false);
 const [sound,setSound]=useSoundSettings(),soundEnabled=sound.se,setSoundEnabled=(se:boolean)=>setSound({se});
 const playSound=useCallback((kind:PokerSound)=>{audio.current?.play(kind);},[]);
 const navigateToLobby=useCallback(()=>{if(navigating.current)return;navigating.current=true;const duration=audio.current?.play('exit')??0;
  if(duration)navigationTimer.current=setTimeout(()=>window.location.assign('/poker-lobby'),duration);else window.location.assign('/poker-lobby');
 },[]);
 useEffect(()=>{if(typeof document==='undefined')return;const sound=new PokerSounds();audio.current=sound;navigating.current=false;
  const unlock=()=>{void sound.unlock();};document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock);
  return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);sound.close();if(audio.current===sound)audio.current=null;if(navigationTimer.current)clearTimeout(navigationTimer.current);};
 },[roomId]);
 useEffect(()=>{audio.current?.setEnabled(soundEnabled);},[soundEnabled,roomId]);
 const client=useRef<PokerPlayerClient|null>(null),busyRef=useRef(false),refreshing=useRef(false),readEpoch=useRef(0),retryAt=useRef(0),readFailures=useRef(0),pollMode=useRef<'spectator'|'player'|null>(null),socketLive=useRef(false),lastRead=useRef(0);
 // Auto rejoin (owner 2026/11/02): after a server restart or a dropped line, a seated player comes back without pressing 参加.
 // Hidden tabs wait until shown, so two open tabs cannot keep stealing the seat from each other.
 const wantPlayer=useRef(false),rejoinTries=useRef(0),rejoinTimer=useRef<ReturnType<typeof setTimeout>|null>(null),joinedAt=useRef(0),quickLosses=useRef(0),rejoinWaiting=useRef(false);
 const [state,setState]=useState<PlayerSnapshot|null>(null),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[message,setMessage]=useState('参加ボタンから接続してください。'),[connectionEpoch,setConnectionEpoch]=useState(0),[,setTick]=useState(0),[exitOpen,setExitOpen]=useState(false),[exitDeadline,setExitDeadline]=useState<number|null>(null);
 async function run(operation:(c:PokerPlayerClient)=>Promise<unknown>){
  void audio.current?.unlock();const c=client.current;if(!c||busyRef.current)return;busyRef.current=true;readEpoch.current++;setBusy(true);
  try{await operation(c);if(client.current===c){setState(c.state);setMessage(c.pending?'前の操作の結果確認が必要です。':'接続中');}}
  catch(error){if(client.current===c){setState(null);pollMode.current=null;setMessage(error instanceof PlayerClientError&&error.status===401?'ログインを確認してください。':error instanceof PlayerClientError&&error.status===409?'接続が切り替わったか、ゲームが進みました。再接続してください。':'接続を確認できません。しばらくしてから再接続してください。');}}
  finally{if(client.current===c){busyRef.current=false;setBusy(false);setPending(c.pending);}}
 }
 function clearRejoin(){if(rejoinTimer.current){clearTimeout(rejoinTimer.current);rejoinTimer.current=null;}rejoinWaiting.current=false;}
 function joined(){wantPlayer.current=true;rejoinTries.current=0;joinedAt.current=Date.now();clearRejoin();}
 function stopAuto(){wantPlayer.current=false;quickLosses.current=0;clearRejoin();}
 /** Returns true when an automatic rejoin was scheduled (the caller then skips its manual-reconnect message). */
 function lostPlayer(){
  if(!wantPlayer.current||!client.current)return false;
  if(Date.now()-joinedAt.current<20000){if(++quickLosses.current>=3){stopAuto();return false;}}else quickLosses.current=0;
  scheduleRejoin();return true;
 }
 function scheduleRejoin(){
  if(rejoinTimer.current||!wantPlayer.current)return;
  if(rejoinTries.current>=8){stopAuto();setMessage('自動で再接続できませんでした。参加ボタンから再接続してください。');return;}
  if(typeof document!=='undefined'&&document.hidden){rejoinWaiting.current=true;setMessage('接続が切れました。この画面に戻ると自動で再接続します。');return;}
  const delay=Math.min(15000,1000*2**rejoinTries.current);rejoinTries.current++;
  setMessage('接続が切れました。自動で再接続しています…');
  rejoinTimer.current=setTimeout(()=>{rejoinTimer.current=null;void autoRejoin();},delay);
 }
 async function autoRejoin(){
  const c=client.current;if(!c||!wantPlayer.current)return;
  if(busyRef.current||c.pending){scheduleRejoin();return;}
  busyRef.current=true;readEpoch.current++;setBusy(true);
  try{await c.join();if(client.current!==c)return;joined();retryAt.current=0;readFailures.current=0;pollMode.current='player';setConnectionEpoch(v=>v+1);setState(c.state);setMessage('接続中');}
  catch(error){if(client.current!==c)return;setState(null);pollMode.current=null;if(error instanceof PlayerClientError&&error.status===401){stopAuto();setMessage('ログインを確認してください。');}else scheduleRejoin();}
  finally{if(client.current===c){busyRef.current=false;setBusy(false);setPending(c.pending);}}
 }
 // Background reads use the transport FIFO, without toggling foreground controls.
 // Never apply a read started before a newer user operation or a session change.
 async function refresh(){
  const c=client.current,mode=pollMode.current,epoch=readEpoch.current;
  if(!c||!mode||refreshing.current||busyRef.current||c.pending||Date.now()<retryAt.current)return;
  refreshing.current=true;lastRead.current=Date.now();
  try{
   await (mode==='player'?c.refresh():c.spectate());
   if(client.current===c&&epoch===readEpoch.current&&!busyRef.current){readFailures.current=0;retryAt.current=0;setState(c.state);setMessage('接続中');}
  }catch(error){
   if(client.current!==c||epoch!==readEpoch.current)return;
   // Hide private state/actions while uncertain, but preserve the capability on
   // transport failures. Auth/permission/conflict failures require explicit reconnect.
   setState(null);
   const status=error instanceof PlayerClientError?error.status:0;
   if(status>=400&&status<500&&![408,429].includes(status)){pollMode.current=null;stopAuto();setMessage(status===401?'ログインを確認してください。':`接続が失効しました（${status}）。再接続してください。`);}
   else{readFailures.current++;retryAt.current=Date.now()+Math.min(10000,1000*2**Math.min(readFailures.current-1,4));setMessage(`通信を再確認しています（${status||'通信エラー'}）。確認完了まで操作を停止しています。`);}
  }finally{if(client.current===c)refreshing.current=false;}
 }
 useEffect(()=>{
  setExitDeadline(null);setState(null);setPending(false);setBusy(false);setConnectionEpoch(0);pollMode.current=null;busyRef.current=false;refreshing.current=false;readEpoch.current++;retryAt.current=0;readFailures.current=0;
  if(!enabled)return;
  const supabase=createClient();const c=new PokerPlayerClient({endpoint:`/api/poker/rooms/${roomId}`,token:async()=>{const {data:{session}}=await supabase.auth.getSession();return session?.access_token??null;}});client.current=c;
  // Session data supplies a credential only; the service re-verifies identity and admission.
  let userId:string|undefined;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||userId!==undefined&&userId!==(session?.user.id??'')){stopAuto();c.close();client.current=null;pollMode.current=null;setExitDeadline(null);setState(null);setPending(false);setBusy(false);busyRef.current=false;setConnectionEpoch(0);setMessage('ログイン状態が変わりました。ページを再読み込みしてください。');}userId=session?.user.id??'';});
  // With the live push channel open, the 1-second read is only a 5-second safety net (owner 2026/10/30: 60-player tournaments).
  const timer=setInterval(()=>{setTick(v=>v+1);if(pollMode.current&&!busyRef.current&&!c.pending&&(!socketLive.current||Date.now()-lastRead.current>=5000))void refresh();},1000);
  const visible=()=>{if(typeof document!=='undefined'&&!document.hidden&&rejoinWaiting.current){rejoinWaiting.current=false;scheduleRejoin();}};const online=()=>{if(rejoinTimer.current){clearTimeout(rejoinTimer.current);rejoinTimer.current=null;void autoRejoin();}};
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',visible);if(typeof window!=='undefined')window.addEventListener?.('online',online);
  return()=>{clearInterval(timer);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visible);if(typeof window!=='undefined')window.removeEventListener?.('online',online);stopAuto();subscription.unsubscribe();c.close();if(client.current===c)client.current=null;busyRef.current=false;};
 },[roomId,enabled]);
 useEffect(()=>{if(state?.autoExitAt!=null)setExitDeadline(current=>current??Date.now()+Math.max(0,state.autoExitAt!-state.serverNow));},[state?.autoExitAt]);
 useEffect(()=>{
  if(exitDeadline===null)return;
  const timer=setTimeout(()=>{stopAuto();pollMode.current=null;client.current?.close();navigateToLobby();},Math.max(0,exitDeadline-Date.now()));
  return()=>clearTimeout(timer);
 },[exitDeadline,navigateToLobby]);
 useEffect(()=>{
  const c=client.current;if(!c||!eventsOrigin||connectionEpoch===0)return;
  let cancelled=false,stop:(()=>void)|undefined;
  void c.watch(eventsOrigin,()=>{if(!cancelled){socketLive.current=true;if(pollMode.current==='player'&&!busyRef.current&&!c.pending)void refresh();}},replaced=>{socketLive.current=false;if(cancelled)return;readEpoch.current++;pollMode.current=null;setState(null);if(replaced){stopAuto();setMessage('別の画面で接続されました。この画面で続けるには再接続してください。');return;}if(!lostPlayer())setMessage('リアルタイム接続が切れました。再接続してください。');}).then(cleanup=>{if(cancelled)cleanup();else stop=cleanup;}).catch(()=>{socketLive.current=false;if(!cancelled){readEpoch.current++;pollMode.current=null;setState(null);if(!lostPlayer())setMessage('リアルタイム接続を開始できません。再接続してください。');}});
  return()=>{cancelled=true;socketLive.current=false;stop?.();};
 },[eventsOrigin,connectionEpoch]);
 // The turn clock runs on locally between reads (reads slow to every 5s while the push channel is live).
 const receivedAt=useMemo(()=>Date.now(),[state]);
 const view=state?{...state,serverNow:state.serverNow+Math.max(0,Date.now()-receivedAt)}:null;
 return <><OnlineTableView roomId={roomId} state={view} onClock={((state?.timeBank as {cards?:number}|undefined)?.cards??0)>0?()=>void run(c=>c.timeBank()):undefined} onSpectate={()=>void run(async c=>{stopAuto();if(c.state?.youSeat!=null)await c.disconnect();await c.spectate();pollMode.current='spectator';setConnectionEpoch(0);})} onExit={()=>setExitOpen(true)} onSound={playSound} soundEnabled={soundEnabled} onSoundToggle={value=>{setSoundEnabled(value);audio.current?.setEnabled(value);if(value)void audio.current?.unlock().then(()=>playSound('turn'));}}>
  <OnlineControls state={view} busy={busy} pending={pending} enabled={enabled} message={message}
   onJoin={()=>void run(async c=>{clearRejoin();quickLosses.current=0;await c.join();if(client.current===c){playSound('enter');joined();}retryAt.current=0;readFailures.current=0;pollMode.current='player';setConnectionEpoch(v=>v+1);})}
   onSpectate={()=>void run(async c=>{stopAuto();if(c.state?.youSeat!=null)await c.disconnect();await c.spectate();if(client.current===c)playSound('enter');pollMode.current='spectator';setConnectionEpoch(0);})}
   onRetry={()=>void run(async c=>{await c.retry();pollMode.current='player';})}
   onTimeBank={()=>void run(c=>c.timeBank())}
   onAct={action=>void run(c=>c.act(action))}/>
  </OnlineTableView>
  {exitOpen&&<div className={shared.seatOverlay}><div className={shared.seatDialog} role="dialog" aria-modal="true" aria-labelledby="online-exit-title"><h2 id="online-exit-title">ゲームを退出しますか？</h2><p>退出しても大会のチップや進行は維持されます。</p>{pending&&<p>先に前の操作の結果を確認してください。</p>}<div className={shared.seatDialogActions}><button type="button" onClick={()=>setExitOpen(false)}>キャンセル</button><button type="button" disabled={busy||pending} onClick={()=>{if(!client.current||!state||state.youSeat===null){navigateToLobby();return;}void run(async c=>{stopAuto();await c.disconnect();pollMode.current=null;if(client.current===c)navigateToLobby();});}}>退出する</button></div></div></div>}
 </>;
}
