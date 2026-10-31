import 'server-only';
import {createClient} from '@/lib/supabase/server';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import type {GtoTier} from './plans';
/** What the GTO side needs: the member's tier (free / light / full), from a paid plan, a trial or a coupon grant. */
export type GtoPlanStatus={tier:GtoTier;active:boolean;expiresAt:string|null;trial:boolean;
 plan:{tier:'light'|'full';period:'month'|'year';status:string;trialEndsAt:string|null;currentPeriodEnd:string|null;cancelAtPeriodEnd:boolean}|null};
const FREE:GtoPlanStatus={tier:'free',active:false,expiresAt:null,trial:false,plan:null};
function parse(v:unknown):GtoPlanStatus{const s=v as GtoPlanStatus|null;return s&&(s.tier==='free'||s.tier==='light'||s.tier==='full')?s:FREE;}
/** The signed-in member's plan (Server Components / route handlers). Logged out = free. */
export async function getGtoPlanStatus():Promise<GtoPlanStatus>{
 try{const client=await createClient();const {data,error}=await client.rpc('gto_plan_status');return error?FREE:parse(data);}catch{return FREE;}
}
export async function getGtoTier():Promise<GtoTier>{return (await getGtoPlanStatus()).tier;}
export async function hasLight():Promise<boolean>{const t=await getGtoTier();return t==='light'||t==='full';}
export async function hasFull():Promise<boolean>{return (await getGtoTier())==='full';}
/** A given member's tier (trusted server code only, e.g. API routes that already know the member). */
export async function getGtoTierFor(memberId:string):Promise<GtoTier>{
 try{const {data,error}=await createServiceRoleClient().rpc('gto_plan_status_for',{p_member:memberId});return error?'free':parse(data).tier;}catch{return 'free';}
}
