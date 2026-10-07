import Link from 'next/link';
import { type SpotJob, shiftTime, transportText } from '@/lib/spot-jobs';
import styles from './spot.module.css';

export function SpotImage({url,name}:{url:string|null;name:string}) {
  return url?<img className={styles.image} src={url} alt={`${name}のスポット求人`}/>:<div className={styles.sign}>{name}<small>POKER SUMMIT</small></div>;
}
export function Restricted() {
  return <div className={styles.box}><h1>スポット勤務を探す</h1><p>このページは登録済みディーラー専用です。</p><Link className={styles.button} href="/account/dealer">ディーラー登録・プロフィール</Link></div>;
}
export function SpotDetail({job,image,date,owner=false}:{job:SpotJob;image:string|null;date?:string;owner?:boolean}) {
  const shifts=[...job.spot_job_shifts].sort((a,b)=>a.work_date.localeCompare(b.work_date));
  const selected=shifts.find(s=>s.work_date===date)||shifts[0];
  const store=job.stores;
  const base=owner?'/store/profile/spot-jobs/':'/spot-jobs/';
  return <><Link href={owner?'/store/profile/spot-jobs':'/spot-jobs'}>← {owner?'スポット求人管理':'スポット勤務一覧'}に戻る</Link>
    <div className={styles.box}><span className={styles.tag}>スポット勤務</span><h1 style={{fontSize:25}}>{store?.name}</h1><p className={styles.muted}>{store?.pref} {store?.city} {store?.address}</p><SpotImage url={image} name={store?.name||'店舗'}/>{owner&&<p className={styles.muted}>店舗向けプレビューです。公開中の求人だけが登録済みディーラーに表示されます。</p>}</div>
    {selected&&<div className={styles.summary}><div><small>勤務日</small><strong>{selected.work_date}</strong></div><div><small>勤務時間</small><strong>{shiftTime(selected)}</strong></div><div><small>時給</small><strong className={styles.wage}>¥{selected.hourly_wage.toLocaleString()}</strong></div><div><small>募集人数</small><strong>{selected.headcount}人</strong></div></div>}
    <div className={styles.detail}><div><section className={styles.box}><h2>業務内容</h2><p className={styles.pre}>{job.duties}</p><div className={styles.checks}>{job.games.map(g=><span className={styles.tag} key={g}>{g}</span>)}</div></section><section className={styles.box}><h2>応募条件</h2><p className={styles.pre}>{job.requirements||'特別な条件の記載なし'}</p></section><section className={styles.box}><h2>交通費・服装・持ち物</h2><p>交通費：{transportText(job)}</p><p className={styles.pre}>{job.dress||'服装・持ち物の指定なし'}</p></section></div>
      <aside><section className={styles.box}><h2>募集日程</h2><div className={styles.dateList}>{shifts.map(s=><Link href={`${base}${job.id}?date=${s.work_date}`} key={s.work_date} aria-current={selected?.work_date===s.work_date}>{s.work_date}<br/>{shiftTime(s)}<br/>時給 ¥{s.hourly_wage.toLocaleString()} ／ {s.headcount}人</Link>)}</div></section><section className={styles.box}><h2>応募締切</h2><p>{new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'medium',timeStyle:'short'}).format(new Date(job.deadline))}</p><p className={styles.muted}>日本時間</p><Link href={`/stores/${job.store_id}`} className={`${styles.button} ${styles.primary}`}>店舗詳細・連絡先を見る</Link><p className={styles.muted}>応募・お問い合わせは店舗の連絡先からお願いします。</p></section></aside></div>
  </>;
}
