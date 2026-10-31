/** Ring rake (owner 2026/10/29): 3% of the contested pot, at most 3 big blinds, no flop no drop; the house keeps it.
 * Shared by the server (ring-hand-owner) and the GTO review, which judges ring hands with the chart for this rake. */
export const RING_RAKE={bps:300,capBb:3} as const;
/** Rake levels with their own preflop chart. Key = `${bps}-${capBb}`. The ring tables use 5%・5BB and 10%・10BB
 * (2026/10/31, set per table); 3%・3BB is kept only to judge hands played before that (RING_RAKE, hands with no rake
 * recorded), so it is not offered in the chart panel (menu: false). */
export const RAKE_CHARTS=[{bps:300,capBb:3,label:'3%・上限3BB',menu:false},{bps:500,capBb:5,label:'5%・上限5BB',menu:true},{bps:1000,capBb:10,label:'10%・上限10BB',menu:true}] as const;
/** A table's own rule (owner 2026/10/31: レーキは卓ごと). Only the charted levels are accepted; anything else falls back. */
/** Rules a ring table can have (owner 2026/10/31: 3%卓はなし). New tables default to the first. */
export const TABLE_RAKES=[{bps:500,capBb:5,label:'低レーキ（5%・上限5BB）'},{bps:1000,capBb:10,label:'高レーキ（10%・上限10BB）'}] as const;
/** Every rule a recorded hand can carry: the table rules plus 3%・3BB (RING_RAKE) for hands played before 2026/10/31. */
const KNOWN_RAKES=[RING_RAKE,...TABLE_RAKES];
export const knownRake=(r:{bps?:unknown;capBb?:unknown}|null|undefined)=>KNOWN_RAKES.some(c=>c.bps===r?.bps&&c.capBb===r?.capBb);
/** A hand's or table's rule; anything missing or unknown is a hand from before per-table rake (3%・3BB). */
export function tableRake(r:{bps?:unknown;capBb?:unknown}|null|undefined):{bps:number;capBb:number}{
 return knownRake(r)?{bps:Number(r!.bps),capBb:Number(r!.capBb)}:{...RING_RAKE};
}
export const rakeKey=(r:{bps:number;capBb:number})=>`${r.bps}-${r.capBb}`;
