import {notFound} from 'next/navigation';
import {PortalHeader} from '@/app/portal-header';
import {PortalFooter} from '@/app/portal-footer';
import {dealerAccess,spotImage} from '@/lib/spot-jobs-server';
import {UUID,type SpotJob} from '@/lib/spot-jobs';
import {SpotDetail,Restricted} from '../detail';
import styles from '../spot.module.css';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:{id:string};searchParams:{date?:string}}) {
  const {db,user,allowed}=await dealerAccess('/spot-jobs/'+params.id);
  if (!allowed) return <><PortalHeader userEmail={user.email}/><main className={styles.public}><Restricted/></main><PortalFooter/></>;
  if (!UUID.test(params.id)) notFound();
  const {data,error}=await db.from('spot_jobs').select('*,spot_job_shifts(*),stores(id,name,pref,city,address,banner_url)').eq('id',params.id).eq('published',true).gt('deadline',new Date().toISOString()).maybeSingle();
  if (error) throw new Error('求人を読み込めませんでした。');
  if (!data) notFound();
  const job=data as unknown as SpotJob;
  const image=await spotImage(db,job,job.stores?.banner_url||null);
  return <><PortalHeader userEmail={user.email}/><main className={styles.public}><SpotDetail job={job} image={image} date={searchParams.date}/></main><PortalFooter/></>;
}
