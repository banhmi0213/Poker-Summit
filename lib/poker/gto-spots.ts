/** Precomputed postflop spots shown on my page (data: public/poker-gto/flops/<id>/<flop>.json, made by
 * scripts/poker-gto/flop-solve.cjs with the ranges in scripts/poker-gto/spots.cjs). */
import flops from '@/data/poker-gto/flops.json';
export const GTO_SPOTS=[
 {id:'utg-bb',group:'シングルレイズ',label:'UTG対BB',detail:'UTGオープン → BBコール（ポット5.5BB）'},
 {id:'hj-bb',group:'シングルレイズ',label:'HJ対BB',detail:'HJオープン → BBコール（ポット5.5BB）'},
 {id:'co-bb',group:'シングルレイズ',label:'CO対BB',detail:'COオープン → BBコール（ポット5.5BB）'},
 {id:'btn-bb',group:'シングルレイズ',label:'BTN対BB',detail:'BTNオープン → BBコール（ポット5.5BB）'},
 {id:'sb-bb',group:'シングルレイズ',label:'SB対BB',detail:'SBオープン → BBコール（ポット6BB、SBが先に打つ）'},
 {id:'utg-btn',group:'シングルレイズ',label:'UTG対BTN',detail:'UTGオープン → BTNコール（ポット6.5BB、UTGが先に打つ）'},
 {id:'co-btn',group:'シングルレイズ',label:'CO対BTN',detail:'COオープン → BTNコール（ポット6.5BB、COが先に打つ）'},
 {id:'utg-bb-3bet',group:'3ベットポット',label:'UTG対BB 3ベット',detail:'UTGオープン → BBが3ベット → UTGコール（ポット24.5BB）'},
 {id:'co-bb-3bet',group:'3ベットポット',label:'CO対BB 3ベット',detail:'COオープン → BBが3ベット → COコール（ポット22.5BB）'},
 {id:'btn-bb-3bet',group:'3ベットポット',label:'BTN対BB 3ベット',detail:'BTNオープン → BBが3ベット → BTNコール（ポット22.5BB）'},
 {id:'btn-sb-3bet',group:'3ベットポット',label:'BTN対SB 3ベット',detail:'BTNオープン → SBが3ベット → BTNコール（ポット23BB、SBが先に打つ）'},
 {id:'co-btn-3bet',group:'3ベットポット',label:'CO対BTN 3ベット',detail:'COオープン → BTNが3ベット → COコール（ポット23.5BB、COが先に打つ）'},
 {id:'btn-bb-4bet',group:'4ベットポット',label:'BTN対BB 4ベット',detail:'BBが3ベット → BTNが4ベット → BBコール（ポット50.5BB）'},
 {id:'sb-limp',group:'SB対BB（リンプ）',label:'SBリンプ対BB',detail:'SBまで全員降りてSBがリンプ → BBチェック（ポット2BB、SBが先に打つ）'},
 {id:'sb-iso',group:'SB対BB（リンプ）',label:'SBリンプ→BBレイズ',detail:'SBリンプ → BBが4BBにレイズ → SBコール（ポット8BB、SBが先に打つ）'},
 {id:'hu-srp',group:'2人（ヘッズアップ）',label:'2人 SBオープン対BB',detail:'SB（ボタン）が2.5BBオープン → BBコール（ポット5BB、BBが先に打つ）'},
 {id:'hu-limp',group:'2人（ヘッズアップ）',label:'2人 リンプポット',detail:'SB（ボタン）がリンプ → BBチェック（ポット2BB、BBが先に打つ）'},
 {id:'hu-3bet',group:'2人（ヘッズアップ）',label:'2人 3ベットポット',detail:'SBオープン → BBが10BBに3ベット → SBコール（ポット20BB）'},
 {id:'co-btn-bb',group:'3人のポット',label:'CO・BTN・BB',detail:'COオープン → BTNコール → BBコール（ポット8BB、BB → CO → BTNの順に打つ）'},
 {id:'btn-sb-bb',group:'3人のポット',label:'BTN・SB・BB',detail:'BTNオープン → SBコール → BBコール（ポット7.5BB、SB → BB → BTNの順に打つ）'},
 {id:'utg-btn-bb',group:'3人のポット',label:'UTG・BTN・BB',detail:'UTGオープン → BTNコール → BBコール（ポット8BB、BB → UTG → BTNの順に打つ）'},
] as const;
export type GtoSpotId=typeof GTO_SPOTS[number]['id'];
/** The 200 representative flops (picked from all 1,755 kinds by scripts/poker-gto/flop-set.cjs; the first 95 are the
 * original set, 2026/10/29 extended to 200). Only those in public/poker-gto/flops/index.json are computed. */
export const GTO_FLOPS:string[]=flops as string[];

/** classes: per starting-hand class [reach, action shares…]. suits (version 2): the same keyed "AKs|21" (how many board
 * cards share each hole card's suit), only where it differs from the class row. */
export type FlopNode={path:number[];player:number;actions:{label:string;kind:string}[];total:number[];classes:Record<string,number[]>;suits?:Record<string,number[]>;children:(number|null)[]};
export type FlopSizes={betSizes:number[];raiseSizes:number[];turnBetSizes?:number[];turnRaiseSizes?:number[];riverBetSizes?:number[];riverRaiseSizes?:number[];allinMaxPot?:number};
/** Three-way files (multiway: true) have `order` (seats in acting order) instead of oop/ip; node.player indexes it. */
export type FlopData={flop:string;board:number[];multiway?:boolean;version?:number;spot:{id?:string;name:string;pot:number;stack:number;oop?:string;ip?:string;order?:string[];note?:string;sizes?:FlopSizes};iterations:number;exploitability:number;nodes:FlopNode[];
 /** Version 3: value of each range from the flop (BB, pot counted as won), overall and per starting-hand class. */
 ev?:{oop:number;ip:number};handEv?:{oop:Record<string,number>;ip:Record<string,number>}};
/** Seat of the player to act at a node (0 = first to act). */
export function seatOf(file:FlopData,player:number):string{return file.spot.order?.[player]??(player===0?file.spot.oop:file.spot.ip)??'';}
/** The bet menu the file was solved with, in words (2026/10/29: shown from the file, so it always matches). */
export function sizeNote(sizes:FlopSizes|undefined,multiway=false):string|null{
 if(!sizes)return null;const p=(l:number[]|undefined)=>(l??[]).map(x=>`${Math.round(x*100)}%`).join('・'),r=(l:number[]|undefined)=>l?.length?`、レイズ${l.join('・')}倍`:'、レイズなし';
 const flop=`フロップ ${p(sizes.betSizes)}${r(sizes.raiseSizes)}`;
 if(multiway)return `ベット額の前提：${flop}。ターン・リバーは打ち合わず、残りのカードを全部配ったときの勝率で分けます。`;
 return `ベット額の前提：${flop}、ターン ${p(sizes.turnBetSizes??sizes.betSizes)}${r(sizes.turnRaiseSizes??sizes.raiseSizes)}、リバー ${p(sizes.riverBetSizes??sizes.betSizes)}${r(sizes.riverRaiseSizes??sizes.raiseSizes)}（オールインはポットの${sizes.allinMaxPot??1.5}倍以内のときだけ）。`;
}
export async function loadFlop(spot:string,flop:string):Promise<FlopData|null>{
 try{const r=await fetch(`/poker-gto/flops/${spot}/${flop}.json`);if(!r.ok)return null;return await r.json() as FlopData;}catch{return null;}
}
/** Which flops are computed so far, per spot (public/poker-gto/flops/index.json). */
export async function loadFlopIndex():Promise<Record<string,string[]>>{
 try{const r=await fetch('/poker-gto/flops/index.json');if(!r.ok)return {};return await r.json() as Record<string,string[]>;}catch{return {};}
}
