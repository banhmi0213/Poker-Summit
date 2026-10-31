/** Ring rake (owner 2026/10/29): 3% of the contested pot, at most 3 big blinds, no flop no drop; the house keeps it.
 * Shared by the server (ring-hand-owner) and the GTO review, which judges ring hands with the chart for this rake. */
export const RING_RAKE={bps:300,capBb:3} as const;
/** Rake levels with their own preflop chart (owner 2026/10/31: 3%・3BB／5%・5BB／10%・10BB). Key = `${bps}-${capBb}`. */
export const RAKE_CHARTS=[{bps:300,capBb:3,label:'3%・上限3BB'},{bps:500,capBb:5,label:'5%・上限5BB'},{bps:1000,capBb:10,label:'10%・上限10BB'}] as const;
export const rakeKey=(r:{bps:number;capBb:number})=>`${r.bps}-${r.capBb}`;
