import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Freeze a viewer-safe copy of one of my hands so it can be linked from the board. */
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(403,{error:'送信元を確認できません。'});
 let hand:string;try{const v=JSON.parse(await request.text());if(typeof v?.hand!=='string'||!uuid.test(v.hand))throw Error();hand=v.hand;}catch{return reply(400,{error:'ハンドを確認できません。'});}
 const client=await createClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)return reply(401,{error:'ログインしてください。'});
 const result=await client.rpc('poker_hand_share',{p_hand:hand});
 if(result.error)return reply(result.error.message.includes('Too many')?429:404,{error:result.error.message.includes('Too many')?'今日はこれ以上共有できません。':'このハンドは共有できません。'});
 return reply(200,{shareId:result.data});
}
