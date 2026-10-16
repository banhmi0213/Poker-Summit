/** Server-owned single-hand room. Authenticated member IDs are trusted transport context,
 * never client payload fields. One owner per room; persistence/transport are not included.
 */
import { randomUUID } from "node:crypto";
import { AuthoritativeHand } from "./authoritative-hand";
import type { HandTerms } from "./tournament-hand";

export type TurnDeadline={handId:string;revision:number;actor:string;expiresAt:number};
type Seat={memberId:string;stack:number;connectionId:string|null};
export class SeatedHandRoom {
  #seats=new Map<number,Seat>(); #hand:AuthoritativeHand|null=null; #revision=0;
  #startingStack:number; #terms:HandTerms;
  #turn:TurnDeadline|null=null; #now:()=>number; #turnMs:number; #lastNow=0;
  constructor(startingStack:number,terms:HandTerms,options:{now?:()=>number;turnMs?:number}={}) {
    if(!Number.isSafeInteger(startingStack)||startingStack<1||startingStack>Math.floor(Number.MAX_SAFE_INTEGER/6))throw new Error("Invalid starting stack");
    const turnMs=options.turnMs??20000;
    if(!Number.isSafeInteger(turnMs)||turnMs<1||turnMs>300000||(options.now!==undefined&&typeof options.now!=="function"))throw new Error("Invalid server clock policy");
    this.#startingStack=startingStack;this.#terms={...terms};this.#turnMs=turnMs;this.#now=options.now??Date.now;
  }
  #readNow() {
    const value=this.#now();
    if(!Number.isSafeInteger(value)||value<0||value>Number.MAX_SAFE_INTEGER-this.#turnMs)throw new Error("Invalid server time");
    this.#lastNow=Math.max(this.#lastNow,value);return this.#lastNow;
  }
  #armTurn(now:number) {
    const h=this.#hand?.snapshot(null);
    this.#turn=h?.toAct&&!h.result?{handId:h.handId,revision:h.revision,actor:h.toAct,expiresAt:now+this.#turnMs}:null;
  }
  #member(memberId:string) {
    if(typeof memberId!=="string"||!memberId.trim()||memberId.length>200)throw new Error("Invalid authenticated member");
    return [...this.#seats].find(([,s])=>s.memberId===memberId);
  }
  #connection(memberId:string,connectionId:string):[number,Seat] {
    const entry=this.#member(memberId);
    if(!entry||!entry[1].connectionId||entry[1].connectionId!==connectionId)throw new Error("Connection is not current");
    return entry;
  }
  #snapshot(viewerSeat:number|null) {
    const hand=this.#hand?.snapshot(viewerSeat===null?null:`seat-${viewerSeat}`)??null;
    return {revision:this.#revision,phase:hand?.result?"complete":hand?"playing":"waiting",youSeat:viewerSeat,turn:this.#turn?{...this.#turn}:null,
      seats:Array.from({length:6},(_,i)=>{const s=this.#seats.get(i+1);return {seat:i+1,id:`seat-${i+1}`,occupied:Boolean(s),connected:Boolean(s?.connectionId)};}),hand};
  }
  /** Auth-to-member binding must already be verified. Stack is room policy, not client input. */
  seat(authenticatedMemberId:string,seatNumber:number) {
    const existing=this.#member(authenticatedMemberId);
    if(this.#hand)throw new Error("Seating is locked for this hand");
    if(existing)throw new Error("Member already seated");
    if(!Number.isSafeInteger(seatNumber)||seatNumber<1||seatNumber>6||this.#seats.has(seatNumber))throw new Error("Seat unavailable");
    this.#seats.set(seatNumber,{memberId:authenticatedMemberId,stack:this.#startingStack,connectionId:null});this.#revision++;
    return this.publicSnapshot();
  }
  /** Rotate every reconnect; send this token only to that authenticated connection.
   * Older sockets cannot act, fetch private cards or disconnect the replacement.
   */
  connect(authenticatedMemberId:string) {
    const entry=this.#member(authenticatedMemberId);if(!entry)throw new Error("Member is not seated");
    const connectionId=randomUUID();entry[1].connectionId=connectionId;this.#revision++;
    return {connectionId,state:this.#snapshot(entry[0])};
  }
  disconnect(authenticatedMemberId:string,connectionId:string) {
    const [,s]=this.#connection(authenticatedMemberId,connectionId);s.connectionId=null;this.#revision++;
  }
  /** Private refresh/reconnect state; neither member ID nor seat can be chosen by an action. */
  snapshot(authenticatedMemberId:string,connectionId:string) {
    return this.#snapshot(this.#connection(authenticatedMemberId,connectionId)[0]);
  }
  publicSnapshot(){return this.#snapshot(null);}
  /** Trusted server scheduling operation, not a player command. Start only once.
   * Disconnected seats cannot be silently skipped or charged on initial start.
   */
  startHand(buttonSeat:number) {
    if(this.#hand)throw new Error("Hand already started");
    const entries=[...this.#seats].sort((a,b)=>a[0]-b[0]);
    if(entries.length<2||!this.#seats.has(buttonSeat)||entries.some(([,s])=>!s.connectionId))throw new Error("Players are not ready");
    const now=this.#readNow();
    const hand=new AuthoritativeHand(entries.map(([n,s])=>({id:`seat-${n}`,stack:s.stack})),entries.findIndex(([n])=>n===buttonSeat),this.#terms);
    this.#hand=hand;this.#armTurn(now);this.#revision++;return this.publicSnapshot();
  }
  act(authenticatedMemberId:string,connectionId:string,payload:unknown) {
    const [n]=this.#connection(authenticatedMemberId,connectionId);
    if(!this.#hand)throw new Error("Hand has not started");
    if(payload&&typeof payload==="object"&&"actionId" in payload&&typeof payload.actionId==="string"&&payload.actionId.startsWith("timeout_"))throw new Error("Reserved action ID");
    const retry=this.#hand.replay(`seat-${n}`,payload);
    if(retry)return {replayed:true,acceptedRevision:retry.acceptedRevision,state:this.#snapshot(n)};
    const now=this.#readNow();
    if(this.#turn&&now>=this.#turn.expiresAt)throw new Error("Turn deadline exceeded");
    const result=this.#hand.act(`seat-${n}`,payload);
    if(!result.replayed){this.#revision++;this.#armTurn(now);}
    return {replayed:result.replayed,acceptedRevision:result.acceptedRevision,state:this.#snapshot(n)};
  }
  /** Trusted scheduler callback: compare the captured hand/revision/actor first.
   * No connection token is needed, but this method must never be a public endpoint.
   * Each late callback performs at most one action and arms a fresh full interval.
   */
  expireTurn(expected:TurnDeadline) {
    const t=this.#turn;
    if(!t||!expected||expected.handId!==t.handId||expected.revision!==t.revision||expected.actor!==t.actor)return {expired:false,state:this.publicSnapshot()};
    const now=this.#readNow();
    if(now<t.expiresAt)return {expired:false,state:this.publicSnapshot()};
    const hand=this.#hand!;
    const legal=hand.snapshot(t.actor).legal;
    if(!legal)throw new Error("Timer actor is not actionable");
    const action={type:legal.check?"check" as const:"fold" as const};
    hand.act(t.actor,{handId:t.handId,revision:t.revision,actionId:"timeout_"+randomUUID(),action});
    this.#revision++;this.#armTurn(now);
    return {expired:true,action:action.type,state:this.publicSnapshot()};
  }
  /** No mid-hand replacement/refund. A disconnect retains the seat and hand state;
   * the original deadline remains in force through disconnect/reconnect.
   */
  leave(authenticatedMemberId:string,connectionId:string) {
    const [n]=this.#connection(authenticatedMemberId,connectionId);
    if(this.#hand&&!this.#hand.snapshot(null).result)throw new Error("Cannot release a seat during a live hand");
    this.#seats.delete(n);this.#revision++;return this.publicSnapshot();
  }
}
