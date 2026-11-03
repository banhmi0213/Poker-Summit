import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private'}});
/** Display names for a tournament's standings list (entry id e-N to name). Owner 2026/10/31. */
export async function GET(request:Request){
 const room=new URL(request.url).searchParams.get('room');if(!room||!/^[-a-f0-9]{36}$/i.test(room))return reply(400,{entrants:[]});
 const client=await createClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)return reply(401,{entrants:[]});
 const result=await client.rpc('poker_tournament_entrant_names',{p_room:room});return result.error?reply(503,{entrants:[]}):reply(200,{entrants:result.data??[]});
}
