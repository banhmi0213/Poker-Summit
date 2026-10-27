import 'server-only';
import {createClient} from '@/lib/supabase/server';

/** Running totals of the staging CPU tables (public.poker_bot_stats, operators only). */
export type BotPositionRow={position:string;style:string;hands:number;vpip:number;pfr:number;three_bet_opp:number;three_bet:number;fold_to_3bet_opp:number;fold_to_3bet:number;cbet_opp:number;cbet:number;fold_to_cbet_opp:number;fold_to_cbet:number;saw_flop:number;wtsd:number;wsd:number;net_bb:number};
export type BotClassRow={position:string;class:string;hands:number;vpip:number;pfr:number;won:number;net_bb:number};
export type BotStats={asOf:string;settings:{enabled:boolean;tables:number;pause_ms:number;keep_hands:number}|null;stored:number;positions:BotPositionRow[];classes:BotClassRow[];
 speed:{hands:number;avgMs:number|null;maxMs:number|null;rssMb:number|null};anomalies:number;recentAnomalies:{at:string;kind:string;detail:string}[]};

export async function loadBotStats():Promise<BotStats|null>{
 const client=await createClient();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return null;
 const {data,error}=await client.rpc('poker_bot_stats');
 if(error||!data||!Array.isArray(data.positions))return null;
 const num=(v:unknown)=>Number(v)||0;
 return {...data,stored:num(data.stored),anomalies:num(data.anomalies),
  positions:data.positions.map((r:Record<string,unknown>)=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,k==='position'||k==='style'?v:num(v)]))),
  classes:data.classes.map((r:Record<string,unknown>)=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,k==='position'||k==='class'?v:num(v)])))} as BotStats;
}

export const BOT_POSITIONS=['UTG','HJ','CO','BTN','SB','BB'];
const R='AKQJT98765432';
/** All 169 starting hands, pairs first then by high card, suited before offsuit. */
export const HAND_CLASSES:string[]=(()=>{const out:string[]=[];for(let i=0;i<13;i++)out.push(R[i]+R[i]);for(let i=0;i<13;i++)for(let j=i+1;j<13;j++){out.push(R[i]+R[j]+'s');out.push(R[i]+R[j]+'o');}return out;})();
