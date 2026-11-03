/** Release switches (owner 2026/10/27: release ring games first). Set NEXT_PUBLIC_POKER_TOURNAMENTS=off on production
 * to hide every member/store-facing tournament page and link; admin pages stay available for preparation. */
export const POKER_TOURNAMENTS_ENABLED=process.env.NEXT_PUBLIC_POKER_TOURNAMENTS!=='off';
