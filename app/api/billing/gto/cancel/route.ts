import {NextResponse,type NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {cancelMemberPlan} from '@/lib/billing/service';
export const dynamic='force-dynamic';
/** Cancel the member's GTO plan (form POST after a confirmation). Trial: no charge ever. Paid: stops renewal, keeps access to the period end. */
export async function POST(req:NextRequest){
 const done=(q:string)=>NextResponse.redirect(new URL('/mypage/poker?pane=plan&billing='+q,req.url),303);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return done('invalid');
 const client=await createClient();const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.redirect(new URL('/login?next=/mypage/poker',req.url),303);
 try{const r=await cancelMemberPlan(user.id);return done(r==='ok'?'canceled':'none');}catch{return done('error');}
}
