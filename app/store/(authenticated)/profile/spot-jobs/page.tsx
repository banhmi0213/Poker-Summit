import { ReadableName } from "@/app/readable-name";
import { MatchingRulesNotice } from "@/app/matching/notice";
import { requireMatchingConsent } from "@/lib/matching-consent-server";
import { matchingReturnWithQuery } from "@/lib/matching-return";
import Link from 'next/link';
import {redirect,notFound} from 'next/navigation';
import {createStoreClient} from '@/lib/supabase/store-server';
import {spotImage} from '@/lib/spot-jobs-server';
import {UUID,japanToday,type SpotJob} from '@/lib/spot-jobs';
import {closeSpotJob} from './actions';
import SpotEditor from './editor';
import styles from '@/app/spot-jobs/spot.module.css';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:{edit?:string;saved?:string;closed?:string;error?:string;page?:string}}) {
  const db=await createStoreClient();
  const {data:{user}}=await db.auth.getUser();
  if (!user) redirect('/store/login?next=/store/profile/spot-jobs');
  const {data:store,error:storeError}=await db.from('stores').select('id,name,pref,city,address,banner_url').eq('owner_user_id',user.id).limit(1).maybeSingle();
  if (storeError) throw new Error('店舗を読み込めませんでした。');
  if (!store) return <main className={styles.manage}>このアカウントに紐づく店舗が見つかりません。</main>;
  await requireMatchingConsent(db,user.id,"store",matchingReturnWithQuery("/store/profile/spot-jobs",searchParams));
  let job:SpotJob|null=null;
  if (searchParams.edit) {
    if (!UUID.test(searchParams.edit)) notFound();
    const {data,error}=await db.from('spot_jobs').select('*,spot_job_shifts(*)').eq('id',searchParams.edit).eq('store_id',store.id).maybeSingle();
    if (error) throw new Error('求人を読み込めませんでした。');
    if (!data) notFound();
    job=data as unknown as SpotJob;
  }
  let editLocked=false;
  if(job){
    const history=await db.from('dealer_matching_records').select('id').eq('spot_job_id',job.id).limit(1);
    if(history.error)throw new Error('応募履歴を確認できませんでした。');
    editLocked=!!history.data?.length;
  }
  const page=Math.max(1,Math.min(10000,Number.parseInt(searchParams.page||'1',10)||1));
  const {data:jobs,error,count}=await db.from('spot_jobs').select('*,spot_job_shifts(*)',{count:'exact'}).eq('store_id',store.id).order('created_at',{ascending:false}).order('id').range((page-1)*6,page*6-1);
  if (error) throw new Error('登録済み求人を読み込めませんでした。');
  const image=await spotImage(db,{image_path:job?.image_path||null,store_id:store.id},store.banner_url);
  return <main className={styles.manage}><div className={styles.heading}><h1>スポット求人</h1><Link className={styles.button} href="/store/profile/dealers">フリーディーラーを探す →</Link></div>
    <p className={styles.muted}>募集は登録済みディーラーにだけ表示されます。店舗情報・所在地は店舗情報から自動で反映されます。</p>
    <div className={styles.buttons}><Link className={styles.button+" "+styles.primary} href="/store/profile/dealer-chat">応募・オファーのチャット</Link><Link className={styles.button+" "+styles.primary} href="/store/profile/spot-jobs/work">✓ 勤務完了・レビューはこちら</Link></div><p className={styles.muted}>応募確認・勤務条件の確定・勤務完了・レビュー・過去の勤務履歴は、こちらから確認できます。</p><MatchingRulesNotice />
    <div className={styles.box}><strong><ReadableName name={store.name} /></strong><p className={styles.muted}>{store.pref} {store.city} {store.address}</p><Link href="/store/profile">店舗情報を編集する →</Link></div>
    {searchParams.saved&&<p className={styles.success} role="status">{job?'変更を保存しました。':'保存しました。続けて新しい求人を登録できます。'}</p>}{searchParams.closed&&<p className={styles.success} role="status">募集を停止しました。</p>}{searchParams.error&&<p className={styles.error} role="alert">処理できませんでした。もう一度お試しください。</p>}
    {job&&<div className={styles.buttons}><Link className={styles.button} href="/store/profile/spot-jobs">新しい求人を登録</Link><Link className={styles.button} href={'/store/profile/spot-jobs/'+job.id}>プレビュー</Link></div>}
    {editLocked?<section className={styles.box}><h2>応募・勤務履歴がある求人</h2><p>当時の求人条件とレビューを残すため、この求人の条件は変更できません。条件を変える場合は新しい求人を登録してください。募集停止は下の一覧から行えます。</p><Link className={styles.button} href='/store/profile/spot-jobs'>新しい求人を登録</Link></section>:<SpotEditor key={(job?.id||'new')+'-'+(searchParams.saved||'')} job={job} today={japanToday()} image={image}/>}
    <section className={styles.box}><h2>登録済みのスポット求人（{count||0}件）</h2>{(jobs as unknown as SpotJob[]||[]).map(j=>{const shifts=[...j.spot_job_shifts].sort((a,b)=>a.work_date.localeCompare(b.work_date));const active=j.published&&Date.parse(j.deadline)>Date.now();return <div className={styles.listing} key={j.id}><div><span className={styles.tag}>{active?'公開中':j.published?'締切済み':'下書き・停止中'}</span><p><strong>{shifts[0]?.work_date||'勤務日なし'}{shifts.length>1?' 〜 '+shifts[shifts.length-1].work_date:''}</strong>（{shifts.length}日）</p><p className={styles.muted}>{j.games.join('・')}</p></div><div className={styles.buttons}><Link className={styles.button} href={'/store/profile/spot-jobs?edit='+j.id}>編集</Link><Link className={styles.button} href={"/store/profile/spot-jobs/work?job="+j.id}>勤務履歴・レビュー</Link><Link className={styles.button} href={'/store/profile/spot-jobs/'+j.id}>プレビュー</Link>{j.published&&<form action={closeSpotJob}><input type="hidden" name="id" value={j.id}/><button className={styles.button}>募集停止</button></form>}</div></div>;})}{!jobs?.length&&<p className={styles.muted}>登録済みの求人はありません。</p>}<nav className={styles.pagination}>{page>1&&<Link className={styles.button} href={'?page='+(page-1)}>前へ</Link>}<span>{page} / {Math.max(1,Math.ceil((count||0)/6))}</span>{page*6<(count||0)&&<Link className={styles.button} href={'?page='+(page+1)}>次へ</Link>}</nav></section>
  </main>;
}
