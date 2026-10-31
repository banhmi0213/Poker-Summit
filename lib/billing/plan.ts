import 'server-only';
import {createClient} from '@/lib/supabase/server';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import type {GtoTier} from './plans';
/** What the GTO side needs: the member's tier (free / standard / pro), from a paid plan, a trial or a coupon grant. */
export type GtoPlanStatus={tier:GtoTier;active:boolean;expiresAt:string|null;trial:boolean;
 plan:{tier:'standard'|'pro';period:'month'|'year';status:string;trialEndsAt:string|null;currentPeriodEnd:string|null;cancelAtPeriodEnd:boolean;amount:number|null}|null};
const FREE:GtoPlanStatus={tier:'free',active:false,expiresAt:null,trial:false,plan:null};
function parse(v:unknown):GtoPlanStatus{const s=v as GtoPlanStatus|null;return s&&(s.tier==='free'||s.tier==='standard'||s.tier==='pro')?s:FREE;}
/** The signed-in member's plan (Server Components / route handlers). Logged out = free. */
export async function getGtoPlanStatus():Promise<GtoPlanStatus>{
 try{const client=await createClient();const {data,error}=await client.rpc('gto_plan_status');return error?FREE:parse(data);}catch{return FREE;}
}
export async function getGtoTier():Promise<GtoTier>{return (await getGtoPlanStatus()).tier;}
/** スタンダード or プロ. */
export async function hasStandard():Promise<boolean>{const t=await getGtoTier();return t==='standard'||t==='pro';}
export async function hasPro():Promise<boolean>{return (await getGtoTier())==='pro';}
/** A given member's tier (trusted server code only, e.g. API routes that already know the member). */
export async function getGtoTierFor(memberId:string):Promise<GtoTier>{
 try{const {data,error}=await createServiceRoleClient().rpc('gto_plan_status_for',{p_member:memberId});return error?'free':parse(data).tier;}catch{return 'free';}
}
