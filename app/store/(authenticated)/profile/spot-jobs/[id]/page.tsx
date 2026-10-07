import { requireMatchingConsent } from "@/lib/matching-consent-server";
import { matchingReturnWithQuery } from "@/lib/matching-return";
import {redirect,notFound} from 'next/navigation';
import {createStoreClient} from '@/lib/supabase/store-server';
import {spotImage} from '@/lib/spot-jobs-server';
import {UUID,type SpotJob} from '@/lib/spot-jobs';
import {SpotDetail} from '@/app/spot-jobs/detail';
import styles from '@/app/spot-jobs/spot.module.css';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:{id:string};searchParams:{date?:string}}) {
  const db=await createStoreClient();
  const {data:{user}}=await db.auth.getUser();
  if (!user) redirect('/store/login');
  if (!UUID.test(params.id)) notFound();
  const {data:store}=await db.from('stores').select('id').eq('owner_user_id',user.id).limit(1).maybeSingle();
  if (!store) notFound();
  await requireMatchingConsent(db,user.id,"store",matchingReturnWithQuery("/store/profile/spot-jobs/"+params.id,searchParams));
  const {data,error}=await db.from('spot_jobs').select('*,spot_job_shifts(*),stores(id,name,pref,city,address,banner_url)').eq('id',params.id).eq('store_id',store.id).maybeSingle();
  if (error) throw new Error('求人を読み込めませんでした。');
  if (!data) notFound();
  const job=data as unknown as SpotJob;
  return <main className={styles.manage}><SpotDetail job={job} image={await spotImage(db,job,job.stores?.banner_url||null)} date={searchParams.date} owner/></main>;
}

