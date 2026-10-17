'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {registrationCatalog,type RegistrationSummary} from '@/lib/poker/registration';
class RegistrationError extends Error{constructor(readonly code:string){super('Registration request failed');}}
export default function TournamentRegistration({enabled}:{enabled:boolean}){
 const [rows,setRows]=useState<RegistrationSummary[]>([]),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(true),[message,setMessage]=useState('受付状況を確認しています。');
 const epoch=useRef(0),mounted=useRef(false),loading=useRef(false);
 async function post(body:unknown){const {data:{session}}=await createClient().auth.getSession();if(!session)throw new RegistrationError('authentication_required');const response=await fetch('/api/poker/lobby',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)}),value=await response.json();if(!response.ok||value?.ok!==true)throw new RegistrationError(value?.error??'unavailable');return value.result;}
 async function run(action?:'register'|'cancel-registration',tournamentId?:string){if(!enabled||loading.current||action&&blocked)return;loading.current=true;setBusy(true);const current=++epoch.current;
  const accept=(data:unknown)=>{if(!mounted.current||current!==epoch.current)return;setRows(registrationCatalog(data));setBlocked(false);};
  try{
   if(action)await post({type:action,tournamentId});if(!mounted.current||current!==epoch.current)return;
   accept(await post({type:'registrations'}));if(mounted.current&&current===epoch.current)setMessage(action==='register'?'参加登録しました。卓割り当て後に「あなたの参加卓」から進めます。':action==='cancel-registration'?'参加登録をキャンセルしました。':'受付状況を更新しました。');
  }catch(error){if(!mounted.current||current!==epoch.current)return;
   if(error instanceof RegistrationError&&['registration_full','registration_closed'].includes(error.code)){
    try{accept(await post({type:'registrations'}));if(current===epoch.current)setMessage(error.code==='registration_full'?'満席になりました。受付状況を更新しました。':'受付が終了または停止しました。');}catch{if(current===epoch.current){setBlocked(true);setMessage('受付状況を確認できません。再読み込みしてください。');}}
   }else{setBlocked(true);setMessage('処理結果を確認できません。受付状況を再読み込みしてから操作してください。');}
  }finally{if(current===epoch.current){loading.current=false;if(mounted.current)setBusy(false);}}
 }
 useEffect(()=>{mounted.current=true;if(!enabled){setRows([]);return()=>{mounted.current=false;};}const supabase=createClient();let member:string|undefined;const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{const next=session?.user.id??'';if(event==='SIGNED_OUT'||member!==undefined&&member!==next){epoch.current++;loading.current=false;setBusy(false);setBlocked(true);setRows([]);setMessage('ログイン状態が変わりました。受付状況を再読み込みしてください。');}member=next;});void run();return()=>{mounted.current=false;epoch.current++;loading.current=false;subscription.unsubscribe();};},[enabled]);
 return <section aria-label="大会の参加受付" style={{padding:16,border:'1px solid #a4c6b7',borderRadius:12,marginBottom:20,overflowWrap:'anywhere'}}><h2>大会の参加受付</h2><p>参加費無料の大会受付です。受付は大会開始または卓割り当てまでです。参加登録と着席は別の手続きです。</p><p role="status">{enabled?message:'オンライン大会の参加受付は準備中です。'}</p>
  {enabled&&<button className="btn" disabled={busy} onClick={()=>void run()}>受付状況を再読み込み</button>}
  {enabled&&rows.length===0&&!busy&&!blocked&&<p>現在、受付設定のある大会はありません。</p>}
  {enabled&&rows.map(row=><article key={row.tournamentId} style={{padding:'16px 0',borderBottom:'1px solid #d5e4dc'}}><h3>{row.title}</h3><p>{new Date(row.starts_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}（日本時間） · 参加登録 {row.count} / {row.capacity}人</p><p>{row.registered?row.assigned?'参加登録済み・卓割り当て確定':'参加登録済み・卓割り当て待ち':!row.registrationOpen?'受付終了・停止中':row.count>=row.capacity?'満席':'受付中'}</p><button className="btn" disabled={busy||blocked||row.registered||!row.registrationOpen||row.count>=row.capacity} onClick={()=>void run('register',row.tournamentId)}>参加登録する</button>{row.registered&&<button className="btn" style={{marginLeft:8}} disabled={busy||blocked||!row.canCancel} onClick={()=>void run('cancel-registration',row.tournamentId)}>参加登録をキャンセル</button>}</article>)}
 </section>;
}
