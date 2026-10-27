/** Precomputed postflop spots shown on my page (data: public/poker-gto/flops/<id>/<flop>.json, made by
 * scripts/poker-gto/flop-solve.cjs with the ranges in scripts/poker-gto/spots.cjs). */
import flops from '@/data/poker-gto/flops.json';
export const GTO_SPOTS=[
 {id:'btn-bb',label:'BTN対BB',detail:'BTNオープン → BBコール（ポット5.5BB）'},
 {id:'co-bb',label:'CO対BB',detail:'COオープン → BBコール（ポット5.5BB）'},
 {id:'sb-bb',label:'SB対BB',detail:'SBオープン → BBコール（ポット6BB）'},
 {id:'btn-bb-3bet',label:'3ベットポット',detail:'BTNオープン → BBが3ベット → BTNコール（ポット22.5BB）'},
] as const;
export type GtoSpotId=typeof GTO_SPOTS[number]['id'];
/** The 95 representative flops (picked from all 1,755 kinds by scripts/poker-gto/flop-set.cjs). */
export const GTO_FLOPS:string[]=flops as string[];

export type FlopNode={path:number[];player:0|1;actions:{label:string;kind:string}[];total:number[];classes:Record<string,number[]>;children:(number|null)[]};
export type FlopData={flop:string;board:number[];spot:{id?:string;name:string;pot:number;stack:number;oop:string;ip:string;note?:string};iterations:number;exploitability:number;nodes:FlopNode[]};
export async function loadFlop(spot:string,flop:string):Promise<FlopData|null>{
 try{const r=await fetch(`/poker-gto/flops/${spot}/${flop}.json`);if(!r.ok)return null;return await r.json() as FlopData;}catch{return null;}
}
