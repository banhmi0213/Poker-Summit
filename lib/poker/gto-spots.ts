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
 {id:'hu-srp',group:'2人（ヘッズアップ）',label:'2人 SBオープン対BB',detail:'SB（ボタン）が2.5BBオープン → BBコール（ポット5BB、BBが先に打つ）'},
 {id:'hu-limp',group:'2人（ヘッズアップ）',label:'2人 リンプポット',detail:'SB（ボタン）がリンプ → BBチェック（ポット2BB、BBが先に打つ）'},
 {id:'hu-3bet',group:'2人（ヘッズアップ）',label:'2人 3ベットポット',detail:'SBオープン → BBが10BBに3ベット → SBコール（ポット20BB）'},
] as const;
export type GtoSpotId=typeof GTO_SPOTS[number]['id'];
/** The 200 representative flops (picked from all 1,755 kinds by scripts/poker-gto/flop-set.cjs; the first 95 are the
 * original set, 2026/10/29 extended to 200). Only those in public/poker-gto/flops/index.json are computed. */
export const GTO_FLOPS:string[]=flops as string[];

/** classes: per starting-hand class [reach, action shares…]. suits (version 2): the same keyed "AKs|21" (how many board
 * cards share each hole card's suit), only where it differs from the class row. */
export type FlopNode={path:number[];player:0|1;actions:{label:string;kind:string}[];total:number[];classes:Record<string,number[]>;suits?:Record<string,number[]>;children:(number|null)[]};
export type FlopData={flop:string;board:number[];spot:{id?:string;name:string;pot:number;stack:number;oop:string;ip:string;note?:string};iterations:number;exploitability:number;nodes:FlopNode[]};
export async function loadFlop(spot:string,flop:string):Promise<FlopData|null>{
 try{const r=await fetch(`/poker-gto/flops/${spot}/${flop}.json`);if(!r.ok)return null;return await r.json() as FlopData;}catch{return null;}
}
/** Which flops are computed so far, per spot (public/poker-gto/flops/index.json). */
export async function loadFlopIndex():Promise<Record<string,string[]>>{
 try{const r=await fetch('/poker-gto/flops/index.json');if(!r.ok)return {};return await r.json() as Record<string,string[]>;}catch{return {};}
}
