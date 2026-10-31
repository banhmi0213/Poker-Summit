import {GTO_BILLING_FLAG} from '@/lib/billing/plans';

/** What a member may see of the GTO tools (owner 2026/11/1). While sales are off (NEXT_PUBLIC_GTO_BILLING not 'on'),
 * everyone gets the free range only and nothing hints at paid parts (no badges, no 「有料」, no link to /pricing).
 * Once sales are on, free members see the free range plus a peek and a button to /pricing (upsell). */
export type GtoAccess={standard:boolean;pro:boolean;upsell:boolean};
export function gtoAccess(tier:string|null|undefined,billing=GTO_BILLING_FLAG):GtoAccess{
 if(!billing)return {standard:false,pro:false,upsell:false};
 const standard=tier==='light'||tier==='standard'||tier==='full'||tier==='pro',pro=tier==='full'||tier==='pro';
 return {standard,pro,upsell:!standard};
}
/** Free members see this many spots of あかんとこ一覧. */
export const FREE_WEAK_SPOTS=3;
