import 'server-only';
import {createClient} from '@/lib/supabase/server';
import type {Card} from './engine';
import type {HistoryAction} from './hand-history';

/** Viewer-filtered hand (see public.poker_hand_history_detail): hole is null unless it is yours,
 * it was shown at showdown, or the caller is an operator. memberId is present only for operators. */
export type HandHistoryView={handId:string;kind:'ring'|'tournament';title:string|null;handNumber:number|null;playedAt:string;
 terms:{sb:number;bb:number;ante:number;anteType:string;level:number};buttonSeatId:string;board:Card[];actions:HistoryAction[];
 result:{showdown:boolean;winners:string[];payouts:Record<string,number>};
 players:{seatId:string;seat:number;position:string;name:string;startStack:number;endStack:number;net:number;folded:boolean;shown:boolean;you:boolean;hole:Card[]|null;memberId?:string}[]};

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function loadHandHistories(admin=false,before?:string):Promise<HandHistoryView[]|null>{
 const client=await createClient();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return null;
 // The RPC independently checks auth.uid(), suspension and admin status.
 const {data,error}=await client.rpc('poker_hand_history_list',{p_admin:admin,p_before:before&&!Number.isNaN(Date.parse(before))?before:null,p_limit:20});
 if(error||!Array.isArray(data))return null;
 return data as HandHistoryView[];
}
export async function loadHandHistory(handId:string,admin=false):Promise<HandHistoryView|null>{
 if(!uuid.test(handId))return null;
 const client=await createClient();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return null;
 const {data,error}=await client.rpc('poker_hand_history_detail',{p_hand:handId,p_admin:admin});
 if(error||!data||!Array.isArray((data as HandHistoryView).players))return null;
 return data as HandHistoryView;
}
