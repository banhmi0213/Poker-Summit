'use client';
import EntryTargets from './entry-targets';
import {useState,useRef} from 'react';
import {managementStatus,type RegistrationManagementStatus} from '@/lib/poker/registration-management';
export default function RegistrationControls({scope,tournamentId,disabled,enabled}:{scope:'admin'|'store';tournamentId:string;disabled:boolean;enabled:boolean}){
 const flight=useRef(false);
 const [status,setStatus]=useState<RegistrationManagementStatus|null>(null),[capacity,setCapacity]=useState(6),[open,setOpen]=useState(false),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState('受付状況を読み込んでから設定してください。');
 async function send(type:'status'|'configure'|'finalize'){
  if(flight.current||disabled||!enabled||type!=='status'&&uncertain)return;flight.current=true;setBusy(true);setConfirm(false);
  try{const payload={scope,tournamentId,type,...(type==='configure'?{capacity,enabled:open}:type==='finalize'?{expectedCount:status?.finalization?.participants??status?.policy?.count}:{})};
   const response=await fetch('/api/poker/registration-management',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)}),body=await response.json();if(!response.ok||body?.ok!==true)throw Error();
   const next=managementStatus(body.result,tournamentId);setStatus(next);if(next.policy){setCapacity(next.policy.capacity);setOpen(next.enabled);}setUncertain(false);setMessage(type==='finalize'?'現在の参加者の卓割り当てを確認しました。':type==='configure'?'受付設定を保存しました。':'受付状況を更新しました。');
  }catch{setUncertain(true);setMessage('結果を確認できません。人数・権限・開始時刻を確認し、状況を再読み込みしてください。確定済み名簿は変更せず、同じ卓の処理を再開します。');}
  finally{flight.current=false;setBusy(false);}
 }
 const plan=status?.finalization,policy=status?.policy,locked=disabled||!enabled||busy,canFinalize=plan?!plan.assigned:Boolean(policy&&policy.count>=2&&policy.count<=200);
 return <><EntryTargets scope={scope} tournamentId={tournamentId} disabled={disabled||!enabled}/><fieldset disabled={locked} style={{border:'1px solid #a4c6b7',borderRadius:10,padding:16,margin:'16px 0',opacity:disabled?0.5:1}}><legend>無料大会の受付・参加者確定</legend>
  <p>参加者確定は2〜200人に対応します（7人以上は6人ずつの複数卓で始まり、人数が減ると卓を移動・統合します）。確定後は受付・キャンセルを停止します。</p><p role="status">{enabled?message:'通信サーバー準備中のため、受付設定・参加者確定はまだ利用できません。'}</p>
  <button type="button" className="btn" onClick={()=>void send('status')}>受付状況を読み込む</button>
  {status&&<><p>現在の登録：{policy?.count??0}人 ／ 定員 {policy?.capacity??'未設定'}{plan?` · 確定 ${plan.participants}人 · ${plan.assigned?'卓割り当て済み':'割り当て処理待ち'}`:''}</p>
   <label>定員 <input type="number" min={2} max={200} step={1} value={capacity} disabled={Boolean(plan)||uncertain||Boolean(policy?.automatic)} onChange={e=>setCapacity(Number(e.target.value))} style={{width:90,textAlign:'center',margin:8}}/></label>
   <label><input type="checkbox" checked={open} disabled={Boolean(plan)||uncertain||Boolean(policy?.automatic)} onChange={e=>setOpen(e.target.checked)}/> 参加受付を有効にする</label>
   <button type="button" className="btn" disabled={Boolean(policy?.automatic)||Boolean(plan)||uncertain||!Number.isSafeInteger(capacity)||capacity<2||capacity>200} onClick={()=>void send('configure')}>受付設定を保存</button>
   {policy&&policy.count>200&&!plan&&<p>参加者を確定できるのは200人までです。</p>}
   {!policy?.automatic&&!plan&&<label style={{display:'block',margin:'12px 0'}}><input type="checkbox" checked={confirm} disabled={uncertain||!canFinalize} onChange={e=>setConfirm(e.target.checked)}/> 現在の参加者で受付を締め切り、卓へ割り当てる</label>}
   {!policy?.automatic&&<button type="button" className="btn" disabled={uncertain||!canFinalize||!plan&&!confirm} onClick={()=>void send('finalize')}>{plan?plan.assigned?'卓割り当て済み':'同じ卓の割り当て処理を再開':'参加者を確定・卓へ割り当て'}</button>}{policy?.automatic&&<p>指定対象者の卓は開始10分前に自動割り当てされます。手動確定は不要です。</p>}
  </>}
 </fieldset></>;
}
