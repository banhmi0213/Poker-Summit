import {NextResponse,type NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {GTO_BILLING_FLAG,isPaidTier,isPeriod} from '@/lib/billing/plans';
import {komojuConfigured} from '@/lib/billing/komoju';
import {startCheckout} from '@/lib/billing/service';
export const dynamic='force-dynamic';
/** GTO plan sign-up (form POST from the pricing page): send the member to KOMOJU's card page. Dormant until billing is on. */
export async function POST(req:NextRequest){
 const back=(q:string)=>NextResponse.redirect(new URL('/pricing?'+q,req.url),303);
 if(!GTO_BILLING_FLAG||!komojuConfigured())return back('status=unavailable');
 const form=await req.formData().catch(()=>null),tier=form?.get('tier'),period=form?.get('period');
 if(!isPaidTier(tier)||!isPeriod(period)||form?.get('agree')!=='on')return back('status=invalid');
 const client=await createClient();const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.redirect(new URL('/login?next=/pricing',req.url),303);
 try{
  const r=await startCheckout(user.id,user.email??null,tier,period,new URL(req.url).origin);
  if('error' in r)return back('status=already');
  return NextResponse.redirect(r.url,303);
 }catch{return back('status=error');}
}
