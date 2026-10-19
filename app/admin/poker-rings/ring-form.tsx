'use client';
import {useEffect,useState} from 'react';
import {useFormState,useFormStatus} from 'react-dom';
import {useRouter} from 'next/navigation';
import NumberStepper from '@/app/poker-tournaments/number-stepper';
import type {RingTable} from '@/lib/poker/ring-tables';
import {saveRing} from './actions';
import styles from './manager.module.css';
function Submit(){const {pending}=useFormStatus();return <button type="submit" className="btn primary" disabled={pending}>{pending?'保存中…':'卓設定を保存する'}</button>;}
export default function RingForm({record}:{record?:RingTable}){
 const [state,save]=useFormState(saveRing,{ok:false,message:'',id:undefined as string|undefined}),router=useRouter();
 const [values,setValues]=useState({sb:record?.sb??50,bb:record?.bb??100,min_buy_in:record?.min_buy_in??2000,max_buy_in:record?.max_buy_in??10000,sort_order:record?.sort_order??0});
 useEffect(()=>{if(state.ok)router.refresh();},[state,router]);
 if(state.ok)return <div role="status" className={styles.note}>{state.message} <button type="button" className="btn" onClick={()=>window.location.reload()}>一覧を更新して続ける</button></div>;
 const numeric=(name:keyof typeof values,label:string,min=0,max=1000000000)=><div className={styles.field}><span>{label}</span><NumberStepper label={label} value={values[name]} onChange={value=>setValues(v=>({...v,[name]:value}))} min={min} max={max}/><input type="hidden" name={name} value={values[name]}/></div>;
 return <form action={save}><input type="hidden" name="id" value={record?.id??''}/><input type="hidden" name="revision" value={record?.revision??0}/><fieldset className={styles.section}><legend>基本情報</legend><div className={styles.grid}><label className={styles.field}>卓名<input name="title" required maxLength={120} defaultValue={record?.title??''} placeholder="例：SUMMIT BLUE 01"/></label><label className={styles.field}>最大人数<select name="capacity" defaultValue={record?.capacity??6}><option value="6">6人卓</option><option value="2">2人卓（ヘッズアップ）</option></select></label><label className={`${styles.field} ${styles.wide}`}>説明・案内<textarea name="note" maxLength={500} rows={2} defaultValue={record?.note??''}/></label></div></fieldset><fieldset className={styles.section}><legend>ブラインド・持込チップ</legend><div className={styles.grid}>{numeric('sb','スモールブラインド（SB）',1)}{numeric('bb','ビッグブラインド（BB）',2)}{numeric('min_buy_in','最小持込チップ',1)}{numeric('max_buy_in','最大持込チップ',1)}</div></fieldset><fieldset className={styles.section}><legend>表示設定</legend><div className={styles.grid}>{numeric('sort_order','表示順（小さい順）',0,999)}<label className={styles.check}><input type="checkbox" name="published" defaultChecked={record?.published??false}/>ロビーに卓設定を公開する</label></div></fieldset><div className={styles.actions}><Submit/><span>数値の＋／−は10ずつ増減します。</span></div>{state.message&&<p role="alert" className={styles.message}>{state.message}</p>}</form>;
}
