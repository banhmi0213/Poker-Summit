import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {getGtoTier} from '@/lib/billing/plan';
import {FREE_WEAK_SPOTS,gtoAccess} from '@/lib/poker/gto-access';

// GTO records (owner 2026/11/1): graded decisions from every place the member plays, and the 弱点分析 built from them.
// The database functions check the login and keep each member to their own rows (supabase/migrations/*_poker_gto_records.sql).
export const dynamic='force-dynamic';
const SOURCES=new Set(['ring','tournament','practice','trainer','drill','quiz','daily']);
async function member(){const client=await createClient();const {data:{user}}=await client.auth.getUser();return user&&!user.is_anonymous?client:null;}

export async function POST(req:Request){
 const client=await member();if(!client)return NextResponse.json({error:'ログインしてください。'},{status:401});
 let body:unknown;try{body=await req.json();}catch{return NextResponse.json({error:'bad request'},{status:400});}
 const rows=(body as {rows?:unknown})?.rows;
 if(!Array.isArray(rows)||rows.length>200)return NextResponse.json({error:'bad request'},{status:400});
 const {data,error}=await client.rpc('poker_gto_record',{p_rows:rows});
 if(error)return NextResponse.json({error:'保存できませんでした。'},{status:error.message.includes('Too many')?429:500});
 return NextResponse.json({added:data},{headers:{'Cache-Control':'no-store'}});
}

export async function GET(req:Request){
 const client=await member();if(!client)return NextResponse.json({error:'ログインしてください。'},{status:401});
 const u=new URL(req.url),days=Math.max(1,Math.min(3650,Number(u.searchParams.get('days'))||90));
 const sources=(u.searchParams.get('sources')??'').split(',').filter(s=>SOURCES.has(s));
 const seats=Number(u.searchParams.get('seats'))||null;
 const {data,error}=await client.rpc('poker_gto_weak_spots',{p_days:days,p_sources:sources.length?sources:null,p_seats:seats});
 if(error)return NextResponse.json({error:'読み込めませんでした。'},{status:500});
 // Free range (and everyone while sales are off): the first spots only, cut here so the full list never leaves the server.
 const full=gtoAccess(await getGtoTier()).standard,out=data as {spots?:unknown[];more?:number}|null;
 if(!full&&out&&Array.isArray(out.spots)){out.more=Math.max(0,out.spots.length-FREE_WEAK_SPOTS);out.spots=out.spots.slice(0,FREE_WEAK_SPOTS);}
 return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
}
