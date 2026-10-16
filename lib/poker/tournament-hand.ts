/** Local tournament demo hand boundaries. No registration, wallet or multiplayer authority. */
import { createBettingRound, type BettingRound } from "./betting";
import { postBlinds, positions } from "./settlement";
import { tournamentClock, type PokerTournament, type TournamentStructure } from "./tournament";
export type HandTerms = { level: number; index: number; sb: number; bb: number; ante: number; anteType: TournamentStructure["anteType"] };
export const ringTerms: HandTerms = {level:0,index:0,sb:50,bb:100,ante:0,anteType:"none"};
export function tournamentHandTerms(t: Pick<PokerTournament,"structure"|"starts_at">, now: number): HandTerms | null {
    const c=tournamentClock(t.structure,t.starts_at,now);
    if(c.phase==="scheduled"||c.phase==="break")return null;
    return {level:c.level,index:c.index,sb:c.period.sb,bb:c.period.bb,ante:c.period.ante,anteType:t.structure.anteType};
}
/** Antes never count toward the street call. BBA is BB-first (TDA 2026 RP-11)
 * and its common money is excluded from the BB player's side-pot matching limit. */
export function startForcedHand(entries: readonly {id:string;stack:number}[], buttonIndex:number, terms:HandTerms) {
    if(!Number.isSafeInteger(terms.sb)||terms.sb<1||!Number.isSafeInteger(terms.bb)||terms.bb<terms.sb||!Number.isSafeInteger(terms.ante)||terms.ante<0||!["none","bb","per-player"].includes(terms.anteType)||(terms.anteType==="none"&&terms.ante!==0))throw new Error("Invalid forced bet settings");
    if(!Number.isSafeInteger(entries.reduce((sum,p)=>sum+p.stack,0)))throw new Error("Total chips exceed safe integer range");
    if(entries.some(p=>!Number.isSafeInteger(p.stack)||p.stack<=0))throw new Error("A new hand requires positive stacks");
    const pos=positions(entries.map(p=>p.id),buttonIndex);
    const antePaid:Record<string,number>={};
    const beforeBlinds=entries.map(p=>{
        const paid=terms.anteType==="per-player"?Math.min(p.stack,terms.ante):0;
        antePaid[p.id]=paid;
        return {...p,stack:p.stack-paid,totalCommitted:paid};
    });
    const posted=postBlinds(beforeBlinds,buttonIndex,terms.sb,terms.bb);
    const players=posted.players.map(p=>{
        const bba=terms.anteType==="bb"&&p.id===pos.bb?Math.min(p.stack,terms.ante):0;
        antePaid[p.id]+=bba;
        return {...p,stack:p.stack-bba,totalCommitted:p.totalCommitted+bba,allIn:p.stack===bba,anteCommitted:antePaid[p.id],sharedAnte:bba};
    });
    const offset=entries.findIndex(p=>p.id===pos.preflopFirst);
    const first=[...players.slice(offset),...players.slice(0,offset)].find(p=>!p.allIn)?.id??null;
    const round=createBettingRound(players,terms.bb,first,terms.bb);
    return {round,terms:{...terms},antePaid,positions:pos};
}
/** Resetting an unfinished demo refunds each player's own ante and wagers once. */
export function carriedDemoStacks(round:BettingRound,payouts:Record<string,number>|null) {
    return Object.fromEntries(round.players.map(p=>[p.id,p.stack+(payouts?payouts[p.id]??0:p.totalCommitted)]));
}
