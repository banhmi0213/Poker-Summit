'use client';
import {useEffect,useState} from 'react';
import {useFormState,useFormStatus} from 'react-dom';
import {useRouter} from 'next/navigation';
import type {TournamentFormState} from '@/lib/poker/tournament-admin';
import styles from '@/app/admin/poker-rings/manager.module.css';
function Submit({disabled}:{disabled:boolean}){const {pending}=useFormStatus();return <button type="submit" disabled={disabled||pending}>{pending?'削除中…':'削除を確定する'}</button>;}
export default function RemovalForm({id,title,revision=0,kind,action}:{id:string;title:string;revision?:number;kind:'ring'|'tournament';action:(state:TournamentFormState,form:FormData)=>Promise<TournamentFormState>}){
 const [state,remove]=useFormState(action,{ok:false,message:''}),[confirmation,setConfirmation]=useState(''),router=useRouter();
 useEffect(()=>{if(state.ok)router.refresh();},[state.ok,router]);
 return <details className={styles.danger}><summary>{kind==='ring'?'このリング卓を削除':'この大会を削除'}</summary><p>{kind==='tournament'?'管理一覧・ロビーから除外します。保存済みの成績・履歴・対戦ログは残ります。対戦中、または終了から10分以内の大会は削除できません。':'管理一覧・ロビーから卓設定を削除します。'}</p><form action={remove}><input type="hidden" name="id" value={id}/><input type="hidden" name="title" value={title}/><input type="hidden" name="revision" value={revision}/><label className={styles.field}>確認のため「{title}」を入力<input name="confirmation" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" required/></label><div className={styles.actions}><Submit disabled={confirmation!==title||state.ok}/></div>{state.message&&<p className={styles.message} role="status">{state.message}</p>}</form></details>;
}
