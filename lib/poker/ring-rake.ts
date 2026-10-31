/** Ring rake (owner 2026/10/29): 3% of the contested pot, at most 3 big blinds, no flop no drop; the house keeps it.
 * Shared by the server (ring-hand-owner) and the GTO review, which judges ring hands with the chart for this rake. */
export const RING_RAKE={bps:300,capBb:3} as const;
/** Rake levels with their own preflop chart. Key = `${bps}-${capBb}`. The ring tables use 5%・5BB and 10%・10BB
 * (2026/10/31, set per table); 3%・3BB is kept only to judge hands played before that (RING_RAKE, hands with no rake
 * recorded), so it is not offered in the chart panel (menu: false). */
export const RAKE_CHARTS=[{bps:300,capBb:3,label:'3%・上限3BB',menu:false},{bps:500,capBb:5,label:'5%・上限5BB',menu:true},{bps:1000,capBb:10,label:'10%・上限10BB',menu:true}] as const;
export const rakeKey=(r:{bps:number;capBb:number})=>`${r.bps}-${r.capBb}`;
