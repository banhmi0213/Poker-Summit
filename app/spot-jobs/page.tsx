import { JobTypeTabs } from "@/app/jobs/job-type-tabs";
import { createClient } from "@/lib/supabase/server";
import { MatchingRulesNotice } from "@/app/matching/notice";
import { matchingReturnWithQuery } from "@/lib/matching-return";
import Link from 'next/link';
import {PortalHeader} from '@/app/portal-header';
import {PortalFooter} from '@/app/portal-footer';
import {PREF_OPTIONS} from '@/lib/constants';
import {DEALER_GAMES} from '@/lib/dealers';
import {dealerAccess,spotImage} from '@/lib/spot-jobs-server';
import {japanToday,shiftTime,validDate,type SpotJob,type SpotShift} from '@/lib/spot-jobs';
import {SpotImage,Restricted} from './detail';
import styles from './spot.module.css';
export const dynamic='force-dynamic';
type Params={pref?:string;game?:string;date?:string;page?:string};
export default async function Page({searchParams}:{searchParams:Params}) {
  const initial=await createClient();
  const {data:{user:viewer}}=await initial.auth.getUser();
  if(!viewer)return <><PortalHeader/><main className={styles.public}><Link href="/">← TOPに戻る</Link><JobTypeTabs active="spot"/><Restricted loggedIn={false}/></main><PortalFooter/></>;
  const {db,user,allowed}=await dealerAccess(matchingReturnWithQuery('/spot-jobs',searchParams));
  if (!allowed) return <><PortalHeader userEmail={user.email}/><main className={styles.public}><Link href="/">← TOPに戻る</Link><JobTypeTabs active="spot"/><Restricted/></main><PortalFooter/></>;
  const pref=PREF_OPTIONS.includes(searchParams.pref||'')?searchParams.pref!:'',game=DEALER_GAMES.includes(searchParams.game||'')?searchParams.game!:'',date=validDate(searchParams.date||'')?searchParams.date!:'';
  const page=Math.max(1,Math.min(10000,Number.parseInt(searchParams.page||'1',10)||1));
  const nowJst=new Date(Date.now()+9*3600000).toISOString();
  const todayJst=nowJst.slice(0,10),timeJst=nowJst.slice(11,19);
  let query=db.from('spot_job_shifts').select('*,spot_jobs!inner(*,stores!inner(id,name,pref,city,address,banner_url))',{count:'exact'}).eq('spot_jobs.published',true).gt('spot_jobs.deadline',new Date().toISOString()).or('work_date.gt.'+todayJst+',and(work_date.eq.'+todayJst+',start_time.gt.'+timeJst+')');
  if (pref) query=query.eq('spot_jobs.stores.pref',pref);
  if (game) query=query.contains('spot_jobs.games',[game]);
  if (date) query=query.eq('work_date',date);
  const {data,error,count}=await query.order('work_date').order('start_time').order('id').range((page-1)*6,page*6-1);
  if (error) throw new Error('スポット求人を読み込めませんでした。');
  const rows=(data||[]) as unknown as (SpotShift&{id:string;spot_jobs:SpotJob})[];
  const images=await Promise.all(rows.map(s=>spotImage(db,s.spot_jobs,s.spot_jobs.stores?.banner_url||null)));
  const href=(n:number)=>'/spot-jobs?'+new URLSearchParams({pref,game,date,page:String(n)}).toString();
  return <><PortalHeader userEmail={user.email}/><main className={styles.public}><Link href="/">← TOPに戻る</Link><JobTypeTabs active="spot"/><div className={styles.heading} style={{marginTop:20}}><h1>スポット勤務を探す</h1><span className={styles.tag}>ディーラー専用</span></div><p className={styles.muted}>勤務日ごとの募集を表示しています。店舗の条件を確認してお問い合わせください。</p>
    <MatchingRulesNotice />
    <form className={styles.filters}><select name="pref" defaultValue={pref} aria-label="都道府県"><option value="">都道府県：すべて</option>{PREF_OPTIONS.map(p=><option key={p}>{p}</option>)}</select><select name="game" defaultValue={game} aria-label="ゲーム種目"><option value="">ゲーム：すべて</option>{DEALER_GAMES.map(g=><option key={g}>{g}</option>)}</select><input type="date" name="date" aria-label="勤務日" defaultValue={date} min={japanToday()}/><button className={`${styles.button} ${styles.primary}`}>検索</button><Link className={styles.button} href="/spot-jobs">条件をクリア</Link></form>
    <p className={styles.muted}>{count||0}件 ／ {page}ページ</p><div className={styles.cards}>{rows.map((s,i)=>{const job=s.spot_jobs;return <article key={s.id} className={styles.card}><SpotImage url={images[i]} name={job.stores?.name||'店舗'}/><div className={styles.cardBody}><h2>{job.stores?.name}</h2><p className={styles.muted}>{job.stores?.pref} {job.stores?.city}</p><div className={styles.facts}><strong>{s.work_date}</strong><span>{shiftTime(s)}</span><span className={styles.wage}>時給 ¥{s.hourly_wage.toLocaleString()}</span><span>募集 {s.headcount}人</span></div><p className={styles.muted}>{job.games.join('・')}</p><Link className={`${styles.button} ${styles.primary}`} href={`/spot-jobs/${job.id}?date=${s.work_date}`}>募集詳細を見る →</Link></div></article>;})}</div>{!rows.length&&<div className={styles.box}>条件に合う募集はありません。</div>}
    <nav className={styles.pagination} aria-label="ページ切り替え">{page>1&&<Link className={styles.button} href={href(page-1)}>前へ</Link>}<span>{page} / {Math.max(1,Math.ceil((count||0)/6))}</span>{page*6<(count||0)&&<Link className={styles.button} href={href(page+1)}>次へ</Link>}</nav>
  </main><PortalFooter/></>;
}

