import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private'}});
export async function GET(request:Request){
 const table=new URL(request.url).searchParams.get('table');if(!table||!/^[-a-f0-9]{36}$/i.test(table))return reply(400,{members:[]});
 const client=await createClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)return reply(401,{members:[]});
 const result=await client.rpc('poker_ring_member_profiles',{p_table:table});return result.error?reply(503,{members:[]}):reply(200,{members:result.data??[]});
}
