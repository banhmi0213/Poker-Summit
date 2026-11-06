/** Release switches (owner 2026/10/27: release ring games first). Set NEXT_PUBLIC_POKER_TOURNAMENTS=off on production
 * to hide every member/store-facing tournament page and link; admin pages stay available for preparation. */
export const POKER_TOURNAMENTS_ENABLED=process.env.NEXT_PUBLIC_POKER_TOURNAMENTS!=='off';

/** GTO features hidden (owner 2026/11/06 20:12: 全部隠せ, 20:20: 改善中にしろ): the panes stay in the menu with 「改善中」. The preflop chart is a simplified model, not a solver result,
 * and everything built on it is hidden until it is rebuilt: the player page's GTO panes, the GTO plan, the daily quiz,
 * /learn/preflop and /learn/river-solver, the GTO marks in hand history and 「GTOで振り返る」 at the table.
 * Set NEXT_PUBLIC_POKER_GTO=on (e.g. on a preview) to show them again. Default: hidden. */
let GTO=false;
try{GTO=process.env.NEXT_PUBLIC_POKER_GTO==='on';}catch{GTO=false;}
export const POKER_GTO_ENABLED=GTO;
export const GTO_PANE_IDS=['gto','preflop','flop','trainer','weak','quiz','ranges','river','plan'];
export const GTO_PATHS=['/learn/gto-quiz','/learn/preflop','/learn/river-solver'];
