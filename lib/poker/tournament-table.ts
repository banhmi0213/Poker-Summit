import type { BettingRound } from "./betting";
import type { TournamentStructure } from "./tournament";
import type { BlindPositions } from "./settlement";
export type TournamentPositions = BlindPositions & { sbSeat: string };
function validateSeats(order:readonly string[],live:readonly string[]) {
    if(order.length<2||order.length>6||new Set(order).size!==order.length||live.length<2||new Set(live).size!==live.length||live.some(id=>!order.includes(id)))throw new Error("Invalid table seats");
}
function nextLive(order:readonly string[],live:readonly string[],after:string) {
    const start=order.indexOf(after);if(start<0)throw new Error("Unknown seat");
    for(let n=1;n<=order.length;n++){const id=order[(start+n)%order.length];if(live.includes(id))return id;}
    throw new Error("No live player");
}
function withActors(order:readonly string[],live:readonly string[],button:string,sbSeat:string,sb:string|null,bb:string):TournamentPositions {
    return {button,sbSeat,sb,bb,preflopFirst:nextLive(order,live,bb),postflopFirst:nextLive(order,live,button)};
}
export function initialTournamentPositions(order:readonly string[],live:readonly string[],button:string):TournamentPositions {
    validateSeats(order,live);if(!order.includes(button)||!live.includes(button))throw new Error("Initial button must be occupied");
    const sb=live.length===2?button:nextLive(order,live,button),bb=nextLive(order,live,sb);
    return withActors(order,live,button,sb,sb,bb);
}
/** BB advances to the next surviving seat. Preserve dead SB/button markers.
 * On entering HU the next BB determines the other player's BTN/SB, preventing
 * the previous BB from being charged twice in succession. No re-entry here. */
export function nextTournamentPositions(order:readonly string[],live:readonly string[],previous:TournamentPositions):TournamentPositions {
    validateSeats(order,live);if(!order.includes(previous.bb)||!order.includes(previous.sbSeat))throw new Error("Invalid previous blinds");
    const bb=nextLive(order,live,previous.bb);
    if(live.length===2){const button=live.find(id=>id!==bb)!;return withActors(order,live,button,button,button,bb);}
    const sbSeat=previous.bb,sb=live.includes(sbSeat)?sbSeat:null;
    return withActors(order,live,previous.sbSeat,sbSeat,sb,bb);
}
export type Elimination = {id:string;place:number;tiedThrough:number;comparisonStack:number};
export type TournamentOutcome = {stacks:Record<string,number>;liveIds:string[];eliminated:Elimination[];champion:string|null};
/** Pure, idempotent hand-end accounting. Never eliminate a player before payouts. */
export function finishTournamentHand(round:BettingRound,starting:Readonly<Record<string,number>>,payouts:Readonly<Record<string,number>>,anteType:TournamentStructure["anteType"],prior:readonly Elimination[]=[]):TournamentOutcome {
    if(round.toAct!==null)throw new Error("Hand still has action");
    const ids=round.players.map(p=>p.id);
    if(ids.length<2||ids.length>6||new Set(ids).size!==ids.length||!["none","bb","per-player"].includes(anteType))throw new Error("Invalid tournament hand");
    if(round.players.some(p=>!Number.isSafeInteger(p.anteCommitted??0)||(p.anteCommitted??0)<0||(p.anteCommitted??0)>starting[p.id]))throw new Error("Invalid ante accounting");
    if(Object.keys(payouts).some(id=>!ids.includes(id))||ids.some(id=>!Number.isSafeInteger(payouts[id])||payouts[id]<0||!Number.isSafeInteger(starting[id])||starting[id]<=0))throw new Error("Invalid hand accounting");
    const sum=(a:number[])=>a.reduce((x,y)=>x+y,0);
    const before=sum(ids.map(id=>starting[id])),after=sum(round.players.map(p=>p.stack+payouts[p.id]));
    if(!Number.isSafeInteger(before)||before!==after||sum(ids.map(id=>payouts[id]))!==sum(round.players.map(p=>p.totalCommitted)))throw new Error("Chips must be conserved");
    if(new Set(prior.map(p=>p.id)).size!==prior.length)throw new Error("Duplicate elimination");
    const stacks=Object.fromEntries([...prior.map(p=>[p.id,0]),...round.players.map(p=>[p.id,p.stack+payouts[p.id]])]);
    const liveIds=ids.filter(id=>stacks[id]>0);
    if(!liveIds.length)throw new Error("Tournament requires a survivor");
    if(prior.some(p=>liveIds.includes(p.id)))throw new Error("Eliminated player cannot re-enter");
    const busted=round.players.filter(p=>stacks[p.id]===0);
    const comparison=(id:string)=>starting[id]-(anteType==="bb"?(round.players.find(p=>p.id===id)!.anteCommitted??0):0);
    const fresh=busted.filter(p=>!prior.some(e=>e.id===p.id)).map(p=>{
        const larger=busted.filter(other=>comparison(other.id)>comparison(p.id)).length;
        const same=busted.filter(other=>comparison(other.id)===comparison(p.id)).length;
        const place=liveIds.length+1+larger;
        return {id:p.id,place,tiedThrough:place+same-1,comparisonStack:comparison(p.id)};
    });
    return {stacks,liveIds,eliminated:[...prior,...fresh].sort((a,b)=>a.place-b.place),champion:liveIds.length===1?liveIds[0]:null};
}
