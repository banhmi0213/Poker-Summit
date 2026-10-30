import {createClient} from '@/lib/supabase/server';
import {freeHudStats,parseHudNote} from '@/lib/poker/player-hud';
export const dynamic='force-dynamic';
const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Opponent tendencies at a ring table, addressed by table + seat (member ids never reach the browser).
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,table=params.get('table'),seat=Number(params.get('seat'));
 if(!table||!uuid.test(table)||!Number.isInteger(seat)||seat<1||seat>6)return reply(400,{error:'席を確認できません。'});
 const client=await createClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)return reply(401,{error:'ログインしてください。'});
 const result=await client.rpc('poker_ring_member_hud',{p_table:table,p_seat:seat});
 if(result.error)return reply(503,{error:'成績を取得できません。'});if(!result.data)return reply(404,{error:'この席は空いています。'});const player=result.data as {stats?:Record<string,number>};
 // Only VPIP / PFR / 3ベット / CB reach the browser (owner 2026/10/30).
 return reply(200,{player:{...player,stats:freeHudStats(player.stats??{})}});
}
// Private note and colour label; only the writer ever sees them.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(403,{error:'送信元を確認できません。'});
 let body:ReturnType<typeof parseHudNote>;try{const raw=await request.text();if(new TextEncoder().encode(raw).length>4096)throw Error();body=parseHudNote(JSON.parse(raw));}catch{return reply(400,{error:'メモは500文字以内で入力してください。'});}
 const client=await createClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)return reply(401,{error:'ログインしてください。'});
 const result=await client.rpc('poker_ring_member_note_set',{p_table:body.table,p_seat:body.seat,p_note:body.note,p_color:body.color});
 return result.error?reply(503,{error:'メモを保存できません。'}):reply(200,{saved:result.data});
}
