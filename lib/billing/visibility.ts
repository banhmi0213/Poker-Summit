/** One switch for everything paid (owner decision 2026/11/01 04:00).
 * Until paid sales are decided, members must not see anything paid: the 「GTOプラン」 pane, every link/button to /pricing,
 * and the paid looks (アイコン枠・ネームプレート・スレッドデザイン, with their 「準備中」 locks). While off, equipped
 * placeholders render as 標準.
 * Set NEXT_PUBLIC_PAID_FEATURES=on (e.g. on staging for testers) to show them. Default: off.
 * NOT covered (stay visible): chip-exchange skins (卓・カード, bought with free chips) and the free starter pick.
 * /pricing itself stays reachable by direct URL only (for the KOMOJU review): noindex/nofollow, not in the sitemap, not linked.
 * GTO side: use paidFeaturesVisible() to hide the 「ちょい見せ＋料金ページへのボタン」 too. */
// Literal process.env access so Next.js inlines it into client bundles; guarded for bundles without `process` (tests' esbuild), which stay off.
let PAID_FEATURES=false;
try{PAID_FEATURES=process.env.NEXT_PUBLIC_PAID_FEATURES==='on';}catch{PAID_FEATURES=false;}
export function paidFeaturesVisible():boolean{return PAID_FEATURES;}
