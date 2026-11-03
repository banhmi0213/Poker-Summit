import {NextResponse,type NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {completeCheckout} from '@/lib/billing/service';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Back from KOMOJU's card page (KOMOJU adds ?action=complete or ?action=cancel). */
export async function GET(req:NextRequest){
 const u=new URL(req.url),ref=u.searchParams.get('ref'),action=u.searchParams.get('action');
 const done=(q:string)=>NextResponse.redirect(new URL('/mypage/poker?pane=plan&billing='+q,req.url),303);
 if(!ref||!uuid.test(ref))return done('invalid');
 if(action==='cancel')return done('cancelled');
 const client=await createClient();const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.redirect(new URL('/login?next=/pricing',req.url),303);
 try{const r=await completeCheckout(user.id,ref);return done(r==='ok'?'trial':r==='not_completed'?'incomplete':'invalid');}catch{return done('error');}
}
