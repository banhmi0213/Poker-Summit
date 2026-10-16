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

type Command={handId:string;revision:number;actionId:string;action:BettingAction};
type Result=NonNullable<ReturnType<typeof settleCompletedHand>>;
function object(value:unknown):Record<string,unknown> {
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid command");
  return value as Record<string,unknown>;
}
function exact(value:Record<string,unknown>,keys:string[]) {
  if(Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw new Error("Unexpected command fields");
}
function parseCommand(input:unknown):Command {
  const c=object(input);exact(c,["handId","revision","actionId","action"]);
  if(typeof c.handId!=="string"||typeof c.actionId!=="string"||!/^[a-zA-Z0-9_-]{1,80}$/.test(c.actionId)||!Number.isSafeInteger(c.revision)||Number(c.revision)<0)throw new Error("Invalid command identity");
  const a=object(c.action),type=a.type;
  if(type==="fold"||type==="check"||type==="call")exact(a,["type"]);
  else if(type==="bet"||type==="raise") {exact(a,["type","amount"]);if(!Number.isSafeInteger(a.amount)||Number(a.amount)<=0)throw new Error("Invalid wager");}
  else throw new Error("Unknown action");
  return {handId:c.handId,revision:Number(c.revision),actionId:c.actionId,action:type==="bet"||type==="raise"?{type,amount:Number(a.amount)}:{type} as BettingAction};
}
const copyCards=(cards:readonly Card[])=>cards.map(c=>({...c}));

export class AuthoritativeHand {
  #id=randomUUID(); #revision=0; #round:BettingRound; #street=0;
  #order:string[]; #positions:BlindPositions; #terms:HandTerms;
  #deal:ReturnType<typeof dealDemoHandAtTable>; #result:Result|null=null;
  #receipts=new Map<string,{fingerprint:string;revision:number}>();
  constructor(entries:readonly {id:string;stack:number}[],buttonIndex:number,terms:HandTerms) {
    if(entries.some(p=>typeof p.id!=="string"||(!/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)||Object.hasOwn(Object.prototype,p.id)||p.id==="prototype")))throw new Error("Invalid seat ID");
    const forced=startForcedHand(entries,buttonIndex,terms);
    this.#round=forced.round;this.#order=entries.map(p=>p.id);this.#positions={...forced.positions};this.#terms={...forced.terms};
    this.#deal=dealDemoHandAtTable(this.#order,this.#order,this.#positions.button);
    this.#progress();
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
    if(viewerId!==null&&!this.#order.includes(viewerId))throw new Error("Unknown viewer seat");
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
  /** Synchronous within this owner: no awaits between version check and commit.
   * A retry returns the latest personalized snapshot, but never reapplies a wager.
   * A changed payload with the same per-seat actionId is rejected.
   */
  act(authenticatedSeatId:string,input:unknown) {
    if(!this.#order.includes(authenticatedSeatId))throw new Error("Unknown actor seat");
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
    this.#revision++;this.#receipts.set(key,{fingerprint,revision:this.#revision});
    return {replayed:false,acceptedRevision:this.#revision,state:this.snapshot(authenticatedSeatId)};
  }
}
