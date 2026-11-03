import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';

// Practice-table (CPU) hands (owner 2026/11/1): saved for logged-in members so they can be replayed and counted.
export const dynamic='force-dynamic';
async function member(){const client=await createClient();const {data:{user}}=await client.auth.getUser();return user&&!user.is_anonymous?client:null;}
export async function POST(req:Request){
 const client=await member();if(!client)return NextResponse.json({error:'ログインしてください。'},{status:401});
 let body:{seats?:unknown;net?:unknown;hand?:unknown};try{body=await req.json();}catch{return NextResponse.json({error:'bad request'},{status:400});}
 if(typeof body.seats!=='number'||typeof body.net!=='number'||!body.hand||typeof body.hand!=='object')return NextResponse.json({error:'bad request'},{status:400});
 const {data,error}=await client.rpc('poker_gto_practice_hand_save',{p_seats:body.seats,p_net:body.net,p_hand:body.hand});
 if(error)return NextResponse.json({error:'保存できませんでした。'},{status:error.message.includes('Too many')?429:500});
 return NextResponse.json({id:data},{headers:{'Cache-Control':'no-store'}});
}
export async function GET(req:Request){
 const client=await member();if(!client)return NextResponse.json({error:'ログインしてください。'},{status:401});
 const before=new URL(req.url).searchParams.get('before');
 const {data,error}=await client.rpc('poker_gto_practice_hands',{p_before:before&&!Number.isNaN(Date.parse(before))?before:null,p_limit:20});
 if(error)return NextResponse.json({error:'読み込めませんでした。'},{status:500});
 return NextResponse.json({hands:data??[]},{headers:{'Cache-Control':'no-store'}});
}
