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

