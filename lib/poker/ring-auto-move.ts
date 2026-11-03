/**
 * Ring table auto move (owner 2026/11/01: リングゲームも人数少なくなったら自動でテーブル移すように /
 * レートが変わる場合はレート変わってもいいか確認するように).
 *
 * Pure decision only: which table a seated player at a short table should move to, whether the move keeps the
 * same rate (blinds and rake: done automatically) or changes it (the player is asked first), and how many chips
 * to bring. The move itself uses the normal leave and join, so the wallet rules are unchanged.
 */
import type {RingListing} from './ring-admission';
export type RingRake={bps:number;capBb:number};
export type RingMove={target:RingListing;sameRate:boolean;amount:number};
/** A table this short (or shorter) looks for a busier one. */
export const RING_SHORT_TABLE=2;
/** The table must stay short this long before anything happens (someone may be sitting down). */
export const RING_SHORT_WAIT_MS=10000;
/** Same-rate moves wait this long on screen so the player can choose to stay. */
export const RING_MOVE_COUNTDOWN_MS=5000;

const sameRake=(a:RingRake|undefined,b:RingRake|undefined)=>Boolean(a&&b&&a.bps===b.bps&&a.capBb===b.capBb);

/**
 * @param current  the listing of the table the player sits at
 * @param tables   all listings from the lobby state
 * @param rakes    rake per table id (a table without a known rake never counts as the same rate)
 * @param stack    the player's chips at the table now
 * @param available the player's chips in the wallet (not at a table)
 * @param allowed  whether the player's rank may sit at a table (2026/11/01 ranks)
 */
export function pickRingMove(current:RingListing,tables:readonly RingListing[],rakes:ReadonlyMap<string,RingRake>,stack:number,available:number,allowed:(table:RingListing)=>boolean=()=>true):RingMove|null{
 if(current.occupied>RING_SHORT_TABLE)return null;
 const total=stack+available;
 const open=tables.filter(t=>t.id!==current.id&&allowed(t)&&t.capacity===current.capacity&&t.occupied>=2&&t.occupied<t.capacity&&(t.occupied>current.occupied||t.occupied===current.occupied&&t.id<current.id));
 // Two equally short tables: only one side moves (the one with the larger id), so players never cross over.
 const busiest=(a:RingListing,b:RingListing)=>b.occupied-a.occupied||a.title.localeCompare(b.title,'ja');
 const same=open.filter(t=>t.sb===current.sb&&t.bb===current.bb&&sameRake(rakes.get(t.id),rakes.get(current.id))).sort(busiest)[0];
 // Same rate: the same chips (a short stack tops up to the minimum from the wallet; above the maximum the rest stays in the wallet).
 if(same){const amount=Math.min(Math.max(stack,same.minBuyIn),same.maxBuyIn);if(amount<=total)return {target:same,sameRate:true,amount};}
 // Another rate: the nearest blinds first (then the busier table), and only where the player can afford the minimum.
 const distance=(t:RingListing)=>Math.abs(Math.log(t.bb/current.bb));
 const other=open.filter(t=>t.minBuyIn<=total&&!(t.sb===current.sb&&t.bb===current.bb&&sameRake(rakes.get(t.id),rakes.get(current.id)))).sort((a,b)=>distance(a)-distance(b)||busiest(a,b))[0];
 if(!other)return null;
 const amount=Math.max(other.minBuyIn,Math.min(stack,other.maxBuyIn,total));
 return {target:other,sameRate:false,amount};
}
