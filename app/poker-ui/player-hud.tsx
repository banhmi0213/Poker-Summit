'use client';
import {useEffect,useState} from 'react';
import {HUD_COLORS,HUD_COLOR_LABELS,HUD_COLOR_VALUES,hudRows,isHudColor,type HudColor,type HudPlayer} from '@/lib/poker/player-hud';
import styles from './player-hud.module.css';
// Opponent stats (ring hands only) with a private note and colour label that only the viewer can see.
export function PlayerHud({table,seat,name,onClose,onSaved}:{table:string;seat:number;name:string;onClose:()=>void;onSaved:(seat:number,color:HudColor|null)=>void}){
 const [player,setPlayer]=useState<HudPlayer|null>(null),[error,setError]=useState(''),[note,setNote]=useState(''),[color,setColor]=useState<HudColor|null>(null),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;setPlayer(null);setError('');setMessage('');
  fetch(`/api/poker/table-members/hud?table=${encodeURIComponent(table)}&seat=${seat}`,{cache:'no-store'}).then(async r=>{const body=await r.json().catch(()=>({}));if(!active)return;
   if(!r.ok||!body.player){setError(body.error??'成績を取得できません。');return;}
   const p=body.player as HudPlayer;setPlayer(p);setNote(p.note??'');setColor(isHudColor(p.color)?p.color:null);}).catch(()=>{if(active)setError('成績を取得できません。');});
  return()=>{active=false;};},[table,seat]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 const save=async()=>{setSaving(true);setMessage('');try{const r=await fetch('/api/poker/table-members/hud',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({table,seat,note,color})});const body=await r.json().catch(()=>({}));
  if(!r.ok){setMessage(body.error??'メモを保存できません。');return;}setMessage('保存しました');onSaved(seat,color);}catch{setMessage('メモを保存できません。');}finally{setSaving(false);}};
 return <><div className={styles.backdrop} aria-hidden="true" onClick={onClose}/>
  <div className={styles.panel} role="dialog" aria-modal="true" aria-label={`${name}の成績`}>
   <div className={styles.top}><strong>{name}</strong><button type="button" aria-label="閉じる" onClick={onClose}>×</button></div>
   {error?<p className={styles.message} role="alert">{error}</p>:!player?<p className={styles.message} role="status">読み込み中…</p>:<>
    <p className={styles.hands}>リング {player.stats.hands.toLocaleString()} ハンド</p>
    <div className={styles.grid}>{hudRows(player.stats).map(([label,rate])=><div key={label} className={styles.stat}><span>{label}</span><b>{rate}</b></div>)}</div>
    {!player.you&&<div className={styles.note}>
     <label htmlFor="player-hud-note">自分だけのメモ</label>
     <textarea id="player-hud-note" maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="プレイの特徴など"/>
     <label>色分け</label>
     <div className={styles.colors} role="group" aria-label="色分け">
      <button type="button" className={styles.noColor} aria-pressed={color===null} onClick={()=>setColor(null)}>なし</button>
      {HUD_COLORS.map(c=><button key={c} type="button" aria-label={HUD_COLOR_LABELS[c]} aria-pressed={color===c} style={{background:HUD_COLOR_VALUES[c]}} onClick={()=>setColor(c)}/>)}
     </div>
     <button type="button" className={styles.save} disabled={saving} onClick={save}>{saving?'保存中…':'保存する'}</button>
     {message&&<p className={styles.message} role="status">{message}</p>}
     <p className={styles.private}>メモと色分けはあなたにしか見えません。</p>
    </div>}
   </>}
  </div></>;
}
export function HudColorMark({color}:{color:HudColor|null|undefined}){return color?<span className={styles.colorMark} style={{background:HUD_COLOR_VALUES[color]}} aria-label={`色分け：${HUD_COLOR_LABELS[color]}`} role="img"/>:null;}
export const hudAvatarButtonClass=styles.avatarButton;
