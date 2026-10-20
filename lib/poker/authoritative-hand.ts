/** Server-owned single-hand coordinator. Transport must supply the authenticated seat ID.
 * Not a network endpoint/store: replicas require a shared transaction/CAS before use.
 * Never accept a HandTerms/stack/deck/viewer ID from an untrusted action payload.
 */
import { randomUUID } from "node:crypto";
import { applyBettingAction, beginNextBettingStreet, legalBettingActions, potTotal, type BettingAction, type BettingRound } from "./betting";
import { dealDemoHandAtTable } from "./demo-deal";
import { settleCompletedHand } from "./hand-settlement";
import { startForcedHand, type HandTerms } from "./tournament-hand";
import type { BlindPositions } from "./settlement";
import type { Card } from "./engine";
import { finishTournamentHand, type Elimination } from "./tournament-table";

import {parseHandCommand as parseCommand,type Command} from './hand-command';
type Result=NonNullable<ReturnType<typeof settleCompletedHand>>;
const copyCards=(cards:readonly Card[])=>cards.map(c=>({...c}));

const restoreToken=Symbol("trusted hand restore");
type Initial={entries:{id:string;stack:number}[];buttonIndex:number;terms:HandTerms;table?:{order:string[];positions:BlindPositions}};
export type HandCheckpoint={version:1;id:string;initial:Initial;deal:ReturnType<typeof dealDemoHandAtTable>;commands:{actor:string;command:Command}[]};
export class AuthoritativeHand {
  #initial:Initial; #commands:{actor:string;command:Command}[]=[];
  #id:string=randomUUID(); #revision=0; #round:BettingRound; #street=0;
  #order:string[]; #positions:BlindPositions; #terms:HandTerms;
  #deal:ReturnType<typeof dealDemoHandAtTable>; #result:Result|null=null;
  #starting:Record<string,number>;
  #receipts=new Map<string,{fingerprint:string;revision:number}>();
  constructor(entries:readonly {id:string;stack:number}[],buttonIndex:number,terms:HandTerms,table?:{order:readonly string[];positions:BlindPositions},restore?:{token:symbol;id:string;deal:ReturnType<typeof dealDemoHandAtTable>}) {
    if(entries.some(p=>typeof p.id!=="string"||(!/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)||Object.hasOwn(Object.prototype,p.id)||p.id==="prototype")))throw new Error("Invalid seat ID");
    const order=table?[...table.order]:entries.map(p=>p.id);
    if(table&&JSON.stringify(order.filter(id=>entries.some(p=>p.id===id)))!==JSON.stringify(entries.map(p=>p.id)))throw new Error("Entries must follow physical seat order");
    this.#initial=structuredClone({entries:[...entries],buttonIndex,terms,table:table?{order:[...table.order],positions:table.positions}:undefined});
    this.#starting=Object.fromEntries(entries.map(p=>[p.id,p.stack]));
    const forced=startForcedHand(entries,buttonIndex,terms,table?{...table.positions}:undefined);
    this.#round=forced.round;this.#order=order;this.#positions={...forced.positions};this.#terms={...forced.terms};
    if(restore&&restore.token!==restoreToken)throw new Error("Invalid restore capability");
    this.#deal=restore?structuredClone(restore.deal):dealDemoHandAtTable(this.#order,entries.map(p=>p.id),this.#positions.button);
    if(restore)this.#id=restore.id;
    this.#progress();
  }
  /** Sensitive server-only state. Encrypt before storage; never send over transport. */
  checkpoint():HandCheckpoint {return structuredClone({version:1,id:this.#id,initial:this.#initial,deal:this.#deal,commands:this.#commands});}
  /** Replays accepted commands against the SAME private deal, rebuilding receipts/accounting. */
  static restore(saved:HandCheckpoint) {
    if(saved?.version!==1||typeof saved.id!=="string"||!Array.isArray(saved.commands)||saved.commands.length>4096)throw new Error("Invalid hand checkpoint");
    const i=saved.initial,deal=saved.deal;
    if(!i||!Array.isArray(i.entries)||!deal||!Array.isArray(deal.board)||deal.board.length!==5||!deal.holes)throw new Error("Invalid saved deal");
    const cards=[...deal.board,...i.entries.flatMap(p=>{const h=deal.holes[p.id];if(!Array.isArray(h)||h.length!==2)throw new Error("Invalid saved hole");return h;})];
    if(cards.some(c=>!c||!Number.isInteger(c.rank)||c.rank<2||c.rank>14||!['c','d','h','s'].includes(c.suit))||new Set(cards.map(c=>c.rank+c.suit)).size!==cards.length)throw new Error("Invalid saved cards");
    const hand=new AuthoritativeHand(i.entries,i.buttonIndex,i.terms,i.table,{token:restoreToken,id:saved.id,deal});
    for(const entry of saved.commands) {const r=hand.act(entry.actor,entry.command);if(r.replayed)throw new Error("Duplicate saved command");}
    return hand;
  }
  #progress() {
    while(this.#round.toAct===null&&!this.#result) {
      const result=settleCompletedHand(this.#round,this.#deal.board,this.#deal.holes,this.#order,this.#positions.button,this.#street===3);
      if(result){this.#result=result;if(result.showdown)this.#street=4;return;}
      this.#street++;
      const start=this.#order.indexOf(this.#positions.postflopFirst);
      const first=[...this.#order.slice(start),...this.#order.slice(0,start)].find(id=>this.#round.players.some(p=>p.id===id&&!p.folded&&!p.allIn));
      if(!first)throw new Error("No postflop actor");
      this.#round=beginNextBettingStreet(this.#round,first);
    }
  }
  /** Only this allow-listed projection may cross the transport boundary.
   * null = spectator; member IDs must be resolved from auth + server seating.
   * Returning fresh objects prevents consumers from mutating internal state.
   */
  snapshot(viewerId:string|null) {
    if(viewerId!==null&&!this.#round.players.some(p=>p.id===viewerId))throw new Error("Unknown viewer seat");
    const count=this.#street===0?0:this.#street===1?3:this.#street===2?4:5;
    return {
      handId:this.#id,revision:this.#revision,street:["preflop","flop","turn","river","showdown"][this.#street],
      board:copyCards(this.#deal.board.slice(0,count)),positions:{...this.#positions},terms:{...this.#terms},
      pot:this.#result?0:potTotal(this.#round),toAct:this.#round.toAct,
      players:this.#round.players.map(p=>({id:p.id,stack:p.stack+(this.#result?.payouts[p.id]??0),committed:p.committed,totalCommitted:p.totalCommitted,folded:p.folded,allIn:p.allIn,
        hole:p.id===viewerId||(this.#result?.showdown&&!p.folded)?copyCards(this.#deal.holes[p.id]):null})),
      legal:viewerId?legalBettingActions(this.#round,viewerId):null,
      result:this.#result?{showdown:this.#result.showdown,payouts:{...this.#result.payouts},winners:[...this.#result.winners]}:null,
    };
  }
  /** Server-only terminal accounting; preserves ante-aware elimination ordering. */
  finishTournament(prior:readonly Elimination[]=[]) {
    if(!this.#result)throw new Error("Hand is not settled");
    return finishTournamentHand(this.#round,this.#starting,this.#result.payouts,this.#terms.anteType,prior);
  }
  /** Read-only receipt lookup lets a room acknowledge retries even after a deadline. */
  replay(authenticatedSeatId:string,input:unknown) {
    if(!this.#round.players.some(p=>p.id===authenticatedSeatId))throw new Error("Unknown actor seat");
    const c=parseCommand(input);
    if(c.handId!==this.#id)throw new Error("Wrong hand");
    const receipt=this.#receipts.get(authenticatedSeatId+":"+c.actionId);
    if(!receipt)return null;
    if(receipt.fingerprint!==JSON.stringify(c))throw new Error("Action ID reused with different payload");
    return {replayed:true,acceptedRevision:receipt.revision,state:this.snapshot(authenticatedSeatId)};
  }
  /** Synchronous within this owner: no awaits between version check and commit.
   * A retry returns the latest personalized snapshot, but never reapplies a wager.
   * A changed payload with the same per-seat actionId is rejected.
   */
  act(authenticatedSeatId:string,input:unknown) {
    if(!this.#round.players.some(p=>p.id===authenticatedSeatId))throw new Error("Unknown actor seat");
    const c=parseCommand(input);
    if(c.handId!==this.#id)throw new Error("Wrong hand");
    const key=authenticatedSeatId+":"+c.actionId,fingerprint=JSON.stringify(c),receipt=this.#receipts.get(key);
    if(receipt) {
      if(receipt.fingerprint!==fingerprint)throw new Error("Action ID reused with different payload");
      return {replayed:true,acceptedRevision:receipt.revision,state:this.snapshot(authenticatedSeatId)};
    }
    if(c.revision!==this.#revision)throw new Error("Stale revision");
    if(this.#result)throw new Error("Hand already settled");
    if(this.#receipts.size>=4096)throw new Error("Action limit reached");
    // Roll back progression failures too; rejected commands must never partially apply.
    const prior={round:this.#round,street:this.#street,result:this.#result};
    try {this.#round=applyBettingAction(this.#round,authenticatedSeatId,c.action);this.#progress();}
    catch(error){this.#round=prior.round;this.#street=prior.street;this.#result=prior.result;throw error;}
    this.#revision++;this.#receipts.set(key,{fingerprint,revision:this.#revision});this.#commands.push({actor:authenticatedSeatId,command:structuredClone(c)});
    return {replayed:false,acceptedRevision:this.#revision,state:this.snapshot(authenticatedSeatId)};
  }
}

/** Shared strict grammar for the player request boundary; derives no actor identity. */
export {parseHandCommand} from './hand-command';
