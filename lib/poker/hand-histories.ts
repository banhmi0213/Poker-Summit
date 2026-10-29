import 'server-only';
import {createClient} from '@/lib/supabase/server';
import type {Card} from './engine';
import type {HistoryAction} from './hand-history';

/** Viewer-filtered hand (see public.poker_hand_history_detail): hole is null unless it is yours,
 * it was shown at showdown, or the caller is an operator. memberId is present only for operators. */
export type HandHistoryView={handId:string;kind:'ring'|'tournament';title:string|null;handNumber:number|null;playedAt:string;
 terms:{sb:number;bb:number;ante:number;anteType:string;level:number};buttonSeatId:string;board:Card[];actions:HistoryAction[];
 result:{showdown:boolean;winners:string[];payouts:Record<string,number>;runs?:{board:Card[];winners:string[]}[]};
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

/** Totals from public.poker_hand_stats. Rates are numerator/denominator counts (see lib/poker/hand-stats.ts). */
export type HandStatsSummary={hands:number;net:number;bb100:number;vpip:number;pfr:number;three_bet_opp:number;three_bet:number;fold_to_3bet_opp:number;fold_to_3bet:number;cbet_opp:number;cbet:number;fold_to_cbet_opp:number;fold_to_cbet:number;saw_flop:number;wtsd:number;wsd:number;
 positions:{position:string;hands:number;net:number;bb100:number;vpip:number;pfr:number}[]};
export async function loadHandStats():Promise<{asOf:string;ring:HandStatsSummary;all:HandStatsSummary}|null>{
 const client=await createClient();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return null;
 const {data,error}=await client.rpc('poker_hand_stats',{p_admin:false});
 if(error||!data?.ring)return null;
 return data;
}
export async function loadAdminHandStats():Promise<{asOf:string;members:(HandStatsSummary&{memberId:string;name:string})[]}|null>{
 const client=await createClient();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return null;
 const {data,error}=await client.rpc('poker_hand_stats',{p_admin:true});
 if(error||!Array.isArray(data?.members))return null;
 return data;
}
/** The member's latest ring hands with their own cards, for the GTO deviation summary (2026/10/29). Up to `max`, newest first. */
export async function loadRecentOwnRingHands(max=100):Promise<HandHistoryView[]|null>{
 const out:HandHistoryView[]=[];let before:string|undefined;
 for(let page=0;page<Math.ceil(max/20);page++){
  const list=await loadHandHistories(false,before);if(!list)return page===0?null:out;
  for(const h of list)if(h.kind==='ring'&&h.players.some(p=>p.you&&p.hole?.length===2))out.push(h);
  if(list.length<20)break;before=list[list.length-1].playedAt;
 }
 return out.slice(0,max);
}
