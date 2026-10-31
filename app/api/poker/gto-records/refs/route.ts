import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';

// Which hands already have GTO records (so ring / tournament hands are judged once). POST {source, refs: string[]}.
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();
 if(!user||user.is_anonymous)return NextResponse.json({error:'ログインしてください。'},{status:401});
 let body:{source?:unknown;refs?:unknown};try{body=await req.json();}catch{return NextResponse.json({error:'bad request'},{status:400});}
 if(typeof body.source!=='string'||!Array.isArray(body.refs)||body.refs.length>500||!body.refs.every(r=>typeof r==='string'))return NextResponse.json({error:'bad request'},{status:400});
 const {data,error}=await client.rpc('poker_gto_recorded_refs',{p_source:body.source,p_refs:body.refs});
 if(error)return NextResponse.json({error:'読み込めませんでした。'},{status:500});
 return NextResponse.json({refs:data??[]},{headers:{'Cache-Control':'no-store'}});
}
