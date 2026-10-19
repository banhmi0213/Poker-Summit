'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {PokerPlayerClient,PlayerClientError,type PlayerSnapshot} from '@/lib/poker/player-client';
import {PokerSounds,type PokerSound} from '@/lib/poker/online-sounds';
import {OnlineControls} from './online-controls';
import {OnlineTableView} from './online-table-view';
export {OnlineTableView} from './online-table-view';
import shared from '../../poker-demo/poker-table.module.css';
export default function OnlineTable({roomId,enabled,eventsOrigin}:{roomId:string;enabled:boolean;eventsOrigin?:string}){
 const audio=useRef<PokerSounds|null>(null),navigationTimer=useRef<ReturnType<typeof setTimeout>|null>(null),navigating=useRef(false);
 const [soundEnabled,setSoundEnabled]=useState(true);
 const playSound=useCallback((kind:PokerSound)=>{audio.current?.play(kind);},[]);
 const navigateToLobby=useCallback(()=>{if(navigating.current)return;navigating.current=true;const duration=audio.current?.play('exit')??0;
  if(duration)navigationTimer.current=setTimeout(()=>window.location.assign('/poker-lobby'),duration);else window.location.assign('/poker-lobby');
 },[]);
 useEffect(()=>{if(typeof document==='undefined')return;const sound=new PokerSounds();audio.current=sound;navigating.current=false;
  const unlock=()=>{void sound.unlock();};document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock);
  return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);sound.close();if(audio.current===sound)audio.current=null;if(navigationTimer.current)clearTimeout(navigationTimer.current);};
 },[roomId]);
 useEffect(()=>{audio.current?.setEnabled(soundEnabled);},[soundEnabled,roomId]);
 const client=useRef<PokerPlayerClient|null>(null),busyRef=useRef(false),refreshing=useRef(false),readEpoch=useRef(0),retryAt=useRef(0),readFailures=useRef(0),pollMode=useRef<'spectator'|'player'|null>(null);
 const [state,setState]=useState<PlayerSnapshot|null>(null),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[message,setMessage]=useState('参加ボタンから接続してください。'),[connectionEpoch,setConnectionEpoch]=useState(0),[exitOpen,setExitOpen]=useState(false),[exitDeadline,setExitDeadline]=useState<number|null>(null);
 async function run(operation:(c:PokerPlayerClient)=>Promise<unknown>){
  void audio.current?.unlock();const c=client.current;if(!c||busyRef.current)return;busyRef.current=true;readEpoch.current++;setBusy(true);
  try{await operation(c);if(client.current===c){setState(c.state);setMessage(c.pending?'前の操作の結果確認が必要です。':'接続中');}}
  catch(error){if(client.current===c){setState(null);pollMode.current=null;setMessage(error instanceof PlayerClientError&&error.status===401?'ログインを確認してください。':error instanceof PlayerClientError&&error.status===409?'接続が切り替わったか、ゲームが進みました。再接続してください。':'接続を確認できません。しばらくしてから再接続してください。');}}
  finally{if(client.current===c){busyRef.current=false;setBusy(false);setPending(c.pending);}}
 }
 // Background reads use the transport FIFO, without toggling foreground controls.
 // Never apply a read started before a newer user operation or a session change.
 async function refresh(){
  const c=client.current,mode=pollMode.current,epoch=readEpoch.current;
  if(!c||!mode||refreshing.current||busyRef.current||c.pending||Date.now()<retryAt.current)return;
  refreshing.current=true;
  try{
   await (mode==='player'?c.refresh():c.spectate());
   if(client.current===c&&epoch===readEpoch.current&&!busyRef.current){readFailures.current=0;retryAt.current=0;setState(c.state);setMessage('接続中');}
  }catch(error){
   if(client.current!==c||epoch!==readEpoch.current)return;
   // Hide private state/actions while uncertain, but preserve the capability on
   // transport failures. Auth/permission/conflict failures require explicit reconnect.
   setState(null);
   const status=error instanceof PlayerClientError?error.status:0;
   if(status>=400&&status<500&&![408,429].includes(status)){pollMode.current=null;setMessage(status===401?'ログインを確認してください。':`接続が失効しました（${status}）。再接続してください。`);}
   else{readFailures.current++;retryAt.current=Date.now()+Math.min(10000,1000*2**Math.min(readFailures.current-1,4));setMessage(`通信を再確認しています（${status||'通信エラー'}）。確認完了まで操作を停止しています。`);}
  }finally{if(client.current===c)refreshing.current=false;}
 }
 useEffect(()=>{
  setExitDeadline(null);setState(null);setPending(false);setBusy(false);setConnectionEpoch(0);pollMode.current=null;busyRef.current=false;refreshing.current=false;readEpoch.current++;retryAt.current=0;readFailures.current=0;
  if(!enabled)return;
  const supabase=createClient();const c=new PokerPlayerClient({endpoint:`/api/poker/rooms/${roomId}`,token:async()=>{const {data:{session}}=await supabase.auth.getSession();return session?.access_token??null;}});client.current=c;
  // Session data supplies a credential only; the service re-verifies identity and admission.
  let userId:string|undefined;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||userId!==undefined&&userId!==(session?.user.id??'')){c.close();client.current=null;pollMode.current=null;setExitDeadline(null);setState(null);setPending(false);setBusy(false);busyRef.current=false;setConnectionEpoch(0);setMessage('ログイン状態が変わりました。ページを再読み込みしてください。');}userId=session?.user.id??'';});
  const timer=setInterval(()=>{if(pollMode.current&&!busyRef.current&&!c.pending)void refresh();},1000);
  return()=>{clearInterval(timer);subscription.unsubscribe();c.close();if(client.current===c)client.current=null;busyRef.current=false;};
 },[roomId,enabled]);
 useEffect(()=>{if(state?.autoExitAt!=null)setExitDeadline(current=>current??Date.now()+Math.max(0,state.autoExitAt!-state.serverNow));},[state?.autoExitAt]);
 useEffect(()=>{
  if(exitDeadline===null)return;
  const timer=setTimeout(()=>{pollMode.current=null;client.current?.close();navigateToLobby();},Math.max(0,exitDeadline-Date.now()));
  return()=>clearTimeout(timer);
 },[exitDeadline,navigateToLobby]);
 useEffect(()=>{
  const c=client.current;if(!c||!eventsOrigin||connectionEpoch===0)return;
  let cancelled=false,stop:(()=>void)|undefined;
  void c.watch(eventsOrigin,()=>{if(!cancelled&&pollMode.current==='player'&&!busyRef.current&&!c.pending)void refresh();},()=>{if(cancelled)return;readEpoch.current++;pollMode.current=null;setState(null);setMessage('リアルタイム接続が切れました。再接続してください。');}).then(cleanup=>{if(cancelled)cleanup();else stop=cleanup;}).catch(()=>{if(!cancelled){readEpoch.current++;pollMode.current=null;setState(null);setMessage('リアルタイム接続を開始できません。再接続してください。');}});
  return()=>{cancelled=true;stop?.();};
 },[eventsOrigin,connectionEpoch]);
 return <><OnlineTableView state={state} onExit={()=>setExitOpen(true)} onSound={playSound} soundEnabled={soundEnabled} onSoundToggle={value=>{setSoundEnabled(value);audio.current?.setEnabled(value);if(value)void audio.current?.unlock().then(()=>playSound('turn'));}}>
  <OnlineControls state={state} busy={busy} pending={pending} enabled={enabled} message={message}
   onJoin={()=>void run(async c=>{await c.join();if(client.current===c)playSound('enter');retryAt.current=0;readFailures.current=0;pollMode.current='player';setConnectionEpoch(v=>v+1);})}
   onSpectate={()=>void run(async c=>{if(c.state?.youSeat!=null)await c.disconnect();await c.spectate();if(client.current===c)playSound('enter');pollMode.current='spectator';setConnectionEpoch(0);})}
   onRetry={()=>void run(async c=>{await c.retry();pollMode.current='player';})}
   onTimeBank={()=>void run(c=>c.timeBank())}
   onAct={action=>void run(c=>c.act(action))}/>
  </OnlineTableView>
  {exitOpen&&<div className={shared.seatOverlay}><div className={shared.seatDialog} role="dialog" aria-modal="true" aria-labelledby="online-exit-title"><h2 id="online-exit-title">ゲームを退出しますか？</h2><p>退出しても大会のチップや進行は維持されます。</p>{pending&&<p>先に前の操作の結果を確認してください。</p>}<div className={shared.seatDialogActions}><button type="button" onClick={()=>setExitOpen(false)}>キャンセル</button><button type="button" disabled={busy||pending} onClick={()=>{if(!client.current||!state||state.youSeat===null){navigateToLobby();return;}void run(async c=>{await c.disconnect();pollMode.current=null;if(client.current===c)navigateToLobby();});}}>退出する</button></div></div></div>}
 </>;
}
