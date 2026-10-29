import type {DemoDeal} from '../../lib/poker/card-display';
const ids=['you','p5','p3','p2','p4','p6'];
const deck=Array.from({length:52},(_,i)=>({rank:2+i%13,suit:(['s','h','d','c'] as const)[Math.floor(i/13)]}));
export const initialDeal:DemoDeal={board:deck.slice(0,5),holes:Object.fromEntries(ids.map((id,i)=>[id,deck.slice(5+i*2,7+i*2)]))};
export async function requestDemoDeal(_button:number,live:readonly string[]=ids):Promise<DemoDeal>{return {...initialDeal,holes:Object.fromEntries(live.map(id=>[id,initialDeal.holes[id]]))};}
