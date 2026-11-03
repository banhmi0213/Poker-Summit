import 'server-only';
import {createClient} from '@/lib/supabase/server';
/** One calendar month (Japan time) of ring results: net = sum of hand settlements (after rake). Owner 2026/10/31. */
export type RingMonth={month:string;net:number;hands:number;endBalance:number|null};
export async function loadRingMonthly():Promise<RingMonth[]|null>{
 const client=await createClient();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return null;
 const {data,error}=await client.rpc('poker_ring_monthly');if(error||!Array.isArray(data))return null;
 return (data as Record<string,unknown>[]).filter(r=>typeof r.month==='string'&&/^\d{4}-\d{2}$/.test(r.month)&&Number.isSafeInteger(r.net)&&Number.isSafeInteger(r.hands))
  .map(r=>({month:r.month as string,net:Number(r.net),hands:Number(r.hands),endBalance:Number.isSafeInteger(r.endBalance)?Number(r.endBalance):null}));
}
