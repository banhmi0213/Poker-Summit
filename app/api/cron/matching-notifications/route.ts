import {NextRequest,NextResponse} from 'next/server';
import {deliverMatchingNotifications} from '@/lib/matching-notification-delivery';
import {createClient} from '@supabase/supabase-js';
import {UUID} from '@/lib/spot-jobs';
export const dynamic='force-dynamic';
export const maxDuration=30;
function authorized(request:NextRequest){const secret=process.env.CRON_SECRET;return !!secret&&request.headers.get('authorization')===`Bearer ${secret}`;}
export async function POST(request:NextRequest){
 let record:string;try{record=(await request.json()).record;}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
 if(!UUID.test(record||''))return NextResponse.json({error:'Invalid record'},{status:400});
 if(!authorized(request)){
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)return NextResponse.json({error:'Unauthorized'},{status:401});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await db.auth.getUser(token);if(authError||!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data,error}=await db.from('dealer_matching_records').select('id').eq('id',record).maybeSingle();if(error||!data)return NextResponse.json({error:'Forbidden'},{status:403});
 }
 try{return NextResponse.json(await deliverMatchingNotifications(record));}catch{return NextResponse.json({error:'Delivery unavailable'},{status:503});}
}

// 送りそびれた通知の再送(Vercel Cron から1時間ごと)。応募・チャット直後の送信が
// 一時的に失敗しても、ここで拾い直す(2026/10)。
export async function GET(request:NextRequest){
 if(!authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{return NextResponse.json(await deliverMatchingNotifications(null));}catch{return NextResponse.json({error:'Delivery unavailable'},{status:503});}
}
