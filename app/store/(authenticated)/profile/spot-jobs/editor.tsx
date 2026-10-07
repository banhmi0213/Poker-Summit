'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { DEALER_GAMES } from '@/lib/dealers';
import { type SpotJob, type SpotShift, validDate } from '@/lib/spot-jobs';
import { saveSpotJob } from './actions';
import styles from '@/app/spot-jobs/spot.module.css';

type Defaults = Omit<SpotShift,'work_date'>;
function SaveButtons() {
  const {pending}=useFormStatus();
  return <div className={styles.buttons}><button disabled={pending} name="published" value="true" className={`${styles.button} ${styles.primary}`}>{pending?'保存中…':'公開して保存'}</button><button disabled={pending} name="published" value="false" className={styles.button}>下書き保存</button></div>;
}
export default function SpotEditor({job,today,image}:{job:SpotJob|null;today:string;image:string|null}) {
  const [state,action]=useFormState(saveSpotJob,{error:''});
  const initial=job?.spot_job_shifts.map(s=>({...s,break_minutes:0,start_time:s.start_time.slice(0,5),end_time:s.end_time.slice(0,5)})).sort((a,b)=>a.work_date.localeCompare(b.work_date))||[];
  const [shifts,setShifts]=useState<SpotShift[]>(initial);
  const [defaults,setDefaults]=useState<Defaults>(initial[0]||{start_time:'',end_time:'',break_minutes:0,hourly_wage:0,headcount:1});
  const [month,setMonth]=useState(today.slice(0,7));
  const [from,setFrom]=useState(today),[to,setTo]=useState(today);
  const [dateError,setDateError]=useState('');
  const [transport,setTransport]=useState(job?.transport_type||'none');
  function addDates(dates:string[]) {
    const all=new Set([...shifts.map(s=>s.work_date),...dates]);
    if (all.size>90) {setDateError('勤務日は90日まで選択できます。');return;}
    setDateError('');
    setShifts([...all].sort().map(d=>shifts.find(s=>s.work_date===d)||{...defaults,work_date:d}));
  }
  function range() {
    if (!validDate(from)||!validDate(to)||from>to) {setDateError('開始日・終了日を確認してください。');return;}
    const count=(Date.parse(to)-Date.parse(from))/86400000+1;
    if (count>90) {setDateError('一度に選択できる期間は90日までです。');return;}
    addDates(Array.from({length:count},(_,i)=>new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10)));
  }
  function toggle(d:string) {shifts.some(s=>s.work_date===d)?setShifts(shifts.filter(s=>s.work_date!==d)):addDates([d]);}
  const first=new Date(month+'-01T00:00:00Z');
  const dayCount=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  function move(n:number) {setMonth(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+n,1)).toISOString().slice(0,7));}
  const field=(label:string,name:string,text:string,required=false)=><label className={`${styles.field} ${styles.wide}`}>{label}<textarea name={name} defaultValue={text} required={required} maxLength={name==='dress'?2000:3000}/></label>;
  return <form action={action} className={styles.box}>
    <input type="hidden" name="id" value={job?.id||''}/><input type="hidden" name="shifts" value={JSON.stringify(shifts)}/>
    <h2>{job?'スポット求人を編集':'新しいスポット求人を登録'}</h2>
    <div className={styles.section}><h3>1. 勤務日 *</h3><p className={styles.muted}>期間でまとめて選び、カレンダーで追加・解除できます。選択後に日ごとの時間・時給・人数を変更できます（最大90日）。</p>
      <div className={styles.fields}><label className={styles.field}>開始日<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className={styles.field}>終了日<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
      <button type="button" onClick={range} className={styles.button} style={{marginTop:10}}>期間内を選択</button>
      <div className={styles.calendar}><div className={styles.calendarHead}><button type="button" className={styles.button} onClick={()=>move(-1)} aria-label="前の月">‹</button><strong>{month.replace('-','年 ')}月</strong><button type="button" className={styles.button} onClick={()=>move(1)} aria-label="次の月">›</button></div><div className={styles.days}>{['日','月','火','水','木','金','土'].map(d=><span key={d}>{d}</span>)}{Array.from({length:first.getUTCDay()},(_,i)=><span key={'empty'+i}/>)}{Array.from({length:dayCount},(_,i)=>{const d=month+'-'+String(i+1).padStart(2,'0');return <button type="button" key={d} aria-label={d} aria-pressed={shifts.some(s=>s.work_date===d)} disabled={d<today&&!shifts.some(s=>s.work_date===d)} onClick={()=>toggle(d)}>{i+1}</button>;})}</div></div>
      {dateError&&<p role="alert" className={styles.error}>{dateError}</p>}
    </div>
    <div className={styles.section}><h3>2〜4. 共通の勤務時間・時給・募集人数</h3><p className={styles.muted}>新しく選ぶ日に適用されます。「選択した日に反映」で全日をまとめて変更できます。終了時間が開始時間より早い場合は翌日扱いです。</p><div className={styles.rowFields}>{[['開始時間','start_time','time'],['終了時間','end_time','time'],['時給（円）','hourly_wage','number'],['募集人数','headcount','number']].map(([label,key,type])=><label key={key}>{label}<input type={type} min={1} value={key==='hourly_wage'&&defaults.hourly_wage===0?'':defaults[key as keyof Defaults]} onChange={e=>setDefaults({...defaults,[key]:type==='number'?Number(e.target.value):e.target.value})}/></label>)}</div><button type="button" className={styles.button} style={{marginTop:10}} onClick={()=>setShifts(shifts.map(s=>({...defaults,work_date:s.work_date})))}>選択した日に反映</button>
      <div className={styles.rows}>{shifts.map(s=><div key={s.work_date} className={styles.row}><div className={styles.rowHead}><strong>{s.work_date} {['日','月','火','水','木','金','土'][new Date(s.work_date).getUTCDay()]}曜日</strong><button type="button" className={styles.button} onClick={()=>toggle(s.work_date)}>削除</button></div><div className={styles.rowFields}>{[['開始時間','start_time','time'],['終了時間','end_time','time'],['時給（円）','hourly_wage','number'],['募集人数','headcount','number']].map(([label,key,type])=><label key={key}>{label}<input required type={type} min={1} max={key==='hourly_wage'?100000:key==='headcount'?1000:undefined} value={key==='hourly_wage'&&s.hourly_wage===0?'':s[key as keyof SpotShift]} onChange={e=>setShifts(shifts.map(row=>row.work_date===s.work_date?{...row,[key]:type==='number'?Number(e.target.value):e.target.value}:row))}/></label>)}</div>{s.end_time&&s.start_time&&s.end_time<s.start_time&&<p className={styles.muted}>終了は翌日です。</p>}</div>)}</div><p className={styles.muted}>選択中：{shifts.length}日</p>
    </div>
    <div className={styles.fields} style={{marginTop:22}}><div className={`${styles.field} ${styles.wide}`}>5. ゲーム種目 *<div className={styles.checks}>{DEALER_GAMES.map(g=><label key={g}><input type="checkbox" name="games" value={g} defaultChecked={job?.games.includes(g)}/>{g}</label>)}</div></div>
      {field('6. 業務内容 *','duties',job?.duties||'',true)}{field('7. 応募条件（経験・スキル）','requirements',job?.requirements||'')}
      <label className={styles.field}>8. 交通費<select name="transport_type" value={transport} onChange={e=>setTransport(e.target.value)}><option value="none">支給なし</option><option value="full">全額支給</option><option value="limited">上限あり</option></select></label>{transport==='limited'&&<label className={styles.field}>交通費の上限（円）<input type="number" name="transport_limit" min="0" max="100000" required defaultValue={job?.transport_limit??''}/></label>}
      {field('9. 服装・持ち物','dress',job?.dress||'')}
      <label className={styles.field}>10. 応募締切 *（日本時間）<input type="datetime-local" name="deadline" required defaultValue={job?new Date(Date.parse(job.deadline)+9*3600000).toISOString().slice(0,16):''}/><small className={styles.muted}>最初の勤務開始までに設定してください。</small></label>
      <label className={`${styles.field} ${styles.wide}`}>求人画像（任意）<input type="file" name="image" accept="image/jpeg,image/png,image/webp"/><small className={styles.muted}>JPEG・PNG・WebP、3MB以内。指定しない場合は店舗画像が自動で表示されます。</small></label>
      {image&&<div className={styles.wide}><img src={image} alt="現在の求人画像" className={styles.photoPreview}/>{job?.image_path&&<label className={styles.checks}><input type="checkbox" name="removeImage"/>専用画像を削除し、店舗画像に戻す</label>}</div>}
    </div>
    {state.error&&<p className={styles.error} role="alert">{state.error}</p>}<SaveButtons/>
  </form>;
}
