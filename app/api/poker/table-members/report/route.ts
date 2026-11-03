import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,REASONS=['abuse','name','griefing','cheating','other'];
/** 通報: a player at this table, addressed by seat. Operators review them on /admin/poker-reports. */
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(403,{error:'送信元を確認できません。'});
 let body:{table:string;seat:number;reason:string;note:string};
 try{const raw=await request.text();if(new TextEncoder().encode(raw).length>4096)throw Error();const v=JSON.parse(raw);
  if(typeof v.table!=='string'||!uuid.test(v.table)||!Number.isInteger(v.seat)||v.seat<1||v.seat>6||!REASONS.includes(v.reason)||typeof v.note!=='string'||[...v.note.trim()].length>500)throw Error();
  body={table:v.table,seat:v.seat,reason:v.reason,note:v.note.trim()};}catch{return reply(400,{error:'内容を確認してください（500文字以内）。'});}
 const client=await createClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)return reply(401,{error:'ログインしてください。'});
 const result=await client.rpc('poker_ring_member_report',{p_table:body.table,p_seat:body.seat,p_reason:body.reason,p_note:body.note});
 if(result.error)return reply(result.error.message.includes('Too many')?429:503,{error:result.error.message.includes('Too many')?'今日はこれ以上通報できません。':'通報を送れませんでした。'});
 return reply(200,{ok:true});
}
