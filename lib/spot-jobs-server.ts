import { requireMatchingConsent } from './matching-consent-server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SpotJob } from './spot-jobs';

export async function dealerAccess(next:string) {
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if (!user) redirect('/login?next='+encodeURIComponent(next));
  const [dealer,suspended]=await Promise.all([db.from('dealer_profiles').select('user_id').eq('user_id',user.id).maybeSingle(),db.rpc('is_suspended')]);
  if (dealer.error||suspended.error) throw new Error('閲覧権限を確認できませんでした。');
  const allowed=!!dealer.data&&!suspended.data;
  if (allowed) await requireMatchingConsent(db,user.id,"dealer",next);
  return {db,user,allowed};
}
export async function spotImage(db:SupabaseClient,job:Pick<SpotJob,'image_path'|'store_id'>,banner:string|null):Promise<string|null> {
  if (job.image_path) {
    const {data}=await db.storage.from('spot-job-images').createSignedUrl(job.image_path,300);
    if (data?.signedUrl) return data.signedUrl;
  }
  if (banner) return banner;
  const {data}=await db.from('store_photos').select('url').eq('store_id',job.store_id).order('sort_order',{ascending:true}).limit(1).maybeSingle();
  return data?.url||null;
}


/** 店舗が前回入力したスポット求人・オファーの条件(次の入力欄に最初から入れる、2026/10/22)。 */
export async function latestSpotTemplate(db: any, storeId: string) {
  const { data } = await db
    .from("spot_jobs")
    .select("games,duties,requirements,transport_type,transport_limit,dress,contract_type,payment_method,payment_date,contract_notes,spot_job_shifts(start_time,end_time,hourly_wage,headcount,work_date)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const shift = [...(data.spot_job_shifts ?? [])].sort((a: any, b: any) => String(a.work_date).localeCompare(String(b.work_date)))[0];
  return {
    games: (data.games ?? []) as string[],
    duties: data.duties ?? "",
    requirements: data.requirements ?? "",
    transport_type: data.transport_type ?? "none",
    transport_limit: data.transport_limit ?? null,
    dress: data.dress ?? "",
    contract_type: data.contract_type ?? null,
    payment_method: data.payment_method ?? null,
    payment_date: data.payment_date ?? null,
    contract_notes: data.contract_notes ?? null,
    start_time: shift ? String(shift.start_time).slice(0, 5) : "",
    end_time: shift ? String(shift.end_time).slice(0, 5) : "",
    hourly_wage: shift ? Number(shift.hourly_wage) : null,
    headcount: shift ? Number(shift.headcount) : 1,
  };
}
