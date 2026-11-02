import {paidFeaturesVisible} from '@/lib/billing/visibility';

/** What a member may see of the GTO tools (owner 2026/11/1). While paid features are hidden (paidFeaturesVisible()
 * false, lib/billing/visibility.ts), everyone gets the free range only and nothing hints at paid parts (no badges,
 * no 「有料」, no link to /pricing). Once shown, スタンダード／プロ members get their parts and free members see the
 * free range plus a peek and a button to /pricing (upsell). tier: getGtoTier() from lib/billing/plan.ts. */
export type GtoAccess={standard:boolean;pro:boolean;upsell:boolean};
export function gtoAccess(tier:string|null|undefined,visible=paidFeaturesVisible()):GtoAccess{
 if(!visible)return {standard:false,pro:false,upsell:false};
 const standard=tier==='standard'||tier==='pro',pro=tier==='pro';
 return {standard,pro,upsell:!standard};
}
/** Free members see this many spots of 弱点分析. */
export const FREE_WEAK_SPOTS=3;
