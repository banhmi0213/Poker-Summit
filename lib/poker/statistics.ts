import 'server-only';
import {createClient} from '@/lib/supabase/server';
export type PokerStatistics={asOf:string;players:{member_id:string;name:string;played:number;firsts:number;seconds:number;thirds:number}[];history:{tournament_id:string;title:string;finished_at:string;row:{memberId:string;name:string;place:number;tiedThrough:number}}[];ring:{member_id:string;name:string;available:number;in_play:number;total:number;position:number;updated_at:string}[];upcoming:{id:string;title:string;starts_at:string;room_id:string|null}[]};
export async function loadPokerStatistics(admin=false):Promise<PokerStatistics|null>{
 const client=await createClient();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return null;
 // The RPC independently checks auth.uid(), suspension and admin status.
 const {data,error}=await client.rpc('poker_statistics',{p_admin:admin});
 if(error||!data||!Array.isArray(data.players)||!Array.isArray(data.history)||!Array.isArray(data.ring)||!Array.isArray(data.upcoming))return null;
 return data as PokerStatistics;
}
