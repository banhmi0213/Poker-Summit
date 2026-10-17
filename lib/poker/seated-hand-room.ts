/** Server-owned room with optional tournament continuation. Member IDs are trusted context,
 * never client payload fields. One owner per room; checkpoint primitives do not install persistence/transport.
 */
import { randomUUID, randomInt } from "node:crypto";
import { AuthoritativeHand, type HandCheckpoint } from "./authoritative-hand";
import type { HandTerms } from "./tournament-hand";
import { initialTournamentPositions,nextTournamentPositions,type TournamentPositions,type TournamentOutcome } from "./tournament-table";

export type TurnDeadline={handId:string;revision:number;actor:string;expiresAt:number};
type Seat={memberId:string;stack:number;connectionId:string|null};
export type RoomCheckpoint={version:1;seats:[number,{memberId:string;stack:number}][];hand:HandCheckpoint|null;revision:number;startingStack:number;terms:HandTerms;tournament:boolean;positions:TournamentPositions|null;outcome:TournamentOutcome|null;settledHandId:string|null;handNumber:number;turn:TurnDeadline|null;turnMs:number;lastNow:number;completedAt?:number|null};
export class SeatedHandRoom {
  #seats=new Map<number,Seat>(); #hand:AuthoritativeHand|null=null; #revision=0;
  #startingStack:number; #terms:HandTerms;
  #tournament:boolean; #positions:TournamentPositions|null=null; #outcome:TournamentOutcome|null=null;
  #settledHandId:string|null=null; #handNumber=0; #completedAt:number|null=null;
  #order=Array.from({length:6},(_,i)=>`seat-${i+1}`);
  #turn:TurnDeadline|null=null; #now:()=>number; #turnMs:number; #lastNow=0;
  constructor(startingStack:number,terms:HandTerms,options:{now?:()=>number;turnMs?:number;tournament?:boolean}={}) {
    if(!Number.isSafeInteger(startingStack)||startingStack<1||startingStack>Math.floor(Number.MAX_SAFE_INTEGER/6))throw new Error("Invalid starting stack");
    if(options.tournament!==undefined&&typeof options.tournament!=="boolean")throw new Error("Invalid tournament policy");
    this.#tournament=options.tournament??false;
    const turnMs=options.turnMs??20000;
    if(!Number.isSafeInteger(turnMs)||turnMs<1||turnMs>300000||(options.now!==undefined&&typeof options.now!=="function"))throw new Error("Invalid server clock policy");
    this.#startingStack=startingStack;this.#terms={...terms};this.#turnMs=turnMs;this.#now=options.now??Date.now;
  }
  /** Server-only checkpoint; connection capabilities are deliberately omitted. */
  checkpoint():RoomCheckpoint {
    return structuredClone({version:1,seats:[...this.#seats].map(([n,s])=>[n,{memberId:s.memberId,stack:s.stack}]),hand:this.#hand?.checkpoint()??null,revision:this.#revision,startingStack:this.#startingStack,terms:this.#terms,tournament:this.#tournament,positions:this.#positions,outcome:this.#outcome,settledHandId:this.#settledHandId,handNumber:this.#handNumber,turn:this.#turn,turnMs:this.#turnMs,lastNow:this.#lastNow,completedAt:this.#completedAt});
  }
  /** Only load an authenticated/decrypted server checkpoint. Restored sockets must reconnect. */
  static restore(input:RoomCheckpoint,now:()=>number=Date.now) {
    const s=structuredClone(input);
    if(s?.version!==1||!Array.isArray(s.seats)||s.seats.length>6||!Number.isSafeInteger(s.revision)||s.revision<0||!Number.isSafeInteger(s.lastNow)||s.lastNow<0)throw new Error("Invalid room checkpoint");
    const room=new SeatedHandRoom(s.startingStack,s.terms,{now,turnMs:s.turnMs,tournament:s.tournament});
    const members=new Set<string>();
    for(const [n,seat] of s.seats){room.seat(seat.memberId,n);if(members.has(seat.memberId)||!Number.isSafeInteger(seat.stack)||seat.stack<0)throw new Error("Invalid saved seat");members.add(seat.memberId);room.#seats.set(n,{...seat,connectionId:null});}
    room.#hand=s.hand?AuthoritativeHand.restore(s.hand):null;room.#revision=s.revision;room.#positions=s.positions;room.#outcome=s.outcome;room.#settledHandId=s.settledHandId;room.#handNumber=s.handNumber;room.#turn=s.turn;room.#lastNow=s.lastNow;
    const h=room.#hand?.snapshot(null),t=room.#turn;
    room.#completedAt=h?.result?(s.completedAt??s.lastNow):null;
    if(room.#completedAt!==null&&(!Number.isSafeInteger(room.#completedAt)||room.#completedAt<0||room.#completedAt>s.lastNow)||!h?.result&&s.completedAt!=null)throw new Error("Invalid completion time");
    if((h?.toAct??null)!==(t?.actor??null)||t&&(t.handId!==h?.handId||t.revision!==h?.revision||!Number.isSafeInteger(t.expiresAt)||t.expiresAt<0))throw new Error("Invalid saved deadline");
    return room;
  }
  #readNow() {
    const value=this.#now();
    if(!Number.isSafeInteger(value)||value<0||value>Number.MAX_SAFE_INTEGER-this.#turnMs)throw new Error("Invalid server time");
    this.#lastNow=Math.max(this.#lastNow,value);return this.#lastNow;
  }
  #syncSettlement() {
    const h=this.#hand?.snapshot(null);
    if(!this.#tournament||!h?.result||h.handId===this.#settledHandId)return;
    const outcome=this.#hand!.finishTournament(this.#outcome?.eliminated??[]);
    this.#outcome=outcome;this.#settledHandId=h.handId;
    for(const [n,s] of this.#seats)s.stack=outcome.stacks[`seat-${n}`]??0;
  }
  #armTurn(now:number) {
    this.#syncSettlement();
    const h=this.#hand?.snapshot(null);
    if(h?.result&&this.#completedAt===null)this.#completedAt=now;
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
    const publicHand=this.#hand?.snapshot(null)??null;
    const id=viewerSeat===null?null:`seat-${viewerSeat}`;
    const hand=id&&publicHand?.players.some(p=>p.id===id)?this.#hand!.snapshot(id):publicHand;
    const outcome=this.#outcome?{...this.#outcome,stacks:{...this.#outcome.stacks},liveIds:[...this.#outcome.liveIds],eliminated:this.#outcome.eliminated.map(p=>({...p}))}:null;
    return {revision:this.#revision,mode:this.#tournament?"tournament":"single-hand",phase:outcome?.champion?"finished":hand?.result?"complete":hand?"playing":"waiting",handNumber:this.#handNumber,completedAt:this.#completedAt,tournament:outcome,youSeat:viewerSeat,turn:this.#turn?{...this.#turn}:null,
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
  /** One owner transaction: reconnect an existing seat or choose the first physical vacancy. */
  join(member:string,allowNewSeat:boolean){
    if(typeof allowNewSeat!=='boolean')throw new Error('Invalid join policy');
    if(!this.#member(member)){if(!allowNewSeat||this.#hand)throw new Error('New seating unavailable');const seat=this.#order.findIndex((_,i)=>!this.#seats.has(i+1))+1;if(seat===0)throw new Error('Table full');this.seat(member,seat);}
    return this.connect(member);
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
  /** Transport cleanup only. An obsolete capability must not disconnect a replacement. */
  disconnectConnection(connectionId:string) {
    const entry=[...this.#seats.values()].find(s=>s.connectionId===connectionId);
    if(!entry)return false;entry.connectionId=null;this.#revision++;return true;
  }
  /** Private refresh/reconnect state; neither member ID nor seat can be chosen by an action. */
  snapshot(authenticatedMemberId:string,connectionId:string) {
    return this.#snapshot(this.#connection(authenticatedMemberId,connectionId)[0]);
  }
  publicSnapshot(){return this.#snapshot(null);}
  /** Trusted server scheduling operation, not a player command. Start only once.
   * Disconnected seats cannot be silently skipped or charged on initial start.
   */
  /** Trusted initial roster check; never exposes the member-to-seat mapping. */
  registrationReadiness(members:readonly string[]) {
    if(!Array.isArray(members)||members.length>6||members.some(m=>typeof m!=="string"||!m)||new Set(members).size!==members.length)throw new Error("Invalid starting roster");
    const expected=new Set(members),seats=[...this.#seats.values()],matched=seats.filter(s=>expected.has(s.memberId));
    return {seated:matched.length,connected:matched.filter(s=>s.connectionId).length,ready:members.length>=2&&matched.length===members.length&&seats.length===members.length&&matched.every(s=>s.connectionId!==null)};
  }
  startRegisteredHand(members:readonly string[],terms:HandTerms) {
    if(!this.registrationReadiness(members).ready)throw new Error("Starting roster not ready");
    const seats=[...this.#seats.keys()].sort((a,b)=>a-b);
    return this.startHandWithTerms(seats[randomInt(seats.length)],terms);
  }
  startHand(buttonSeat:number) {return this.startHandWithTerms(buttonSeat,this.#terms);}
  /** Trusted schedule wrapper may select the current level at INITIAL deal time. */
  startHandWithTerms(buttonSeat:number,terms:HandTerms) {
    if(this.#hand)throw new Error("Hand already started");
    const entries=[...this.#seats].sort((a,b)=>a[0]-b[0]);
    if(entries.length<2||!this.#seats.has(buttonSeat)||entries.some(([,s])=>!s.connectionId))throw new Error("Players are not ready");
    const now=this.#readNow();
    const players=entries.map(([n,s])=>({id:`seat-${n}`,stack:s.stack}));
    const positions=this.#tournament?initialTournamentPositions(this.#order,players.map(p=>p.id),`seat-${buttonSeat}`):null;
    const hand=new AuthoritativeHand(players,entries.findIndex(([n])=>n===buttonSeat),terms,positions?{order:this.#order,positions}:undefined);
    this.#hand=hand;this.#completedAt=null;this.#positions=positions;this.#terms={...terms};this.#handNumber=1;this.#armTurn(now);this.#revision++;return this.publicSnapshot();
  }
  /** Trusted tournament scheduler only. A captured completed hand ID makes retries safe.
   * Survivors carry stacks; disconnected survivors remain in play with server deadlines.
   */
  nextHand(expectedHandId:string,terms:HandTerms=this.#terms) {
    if(!this.#tournament||!this.#hand||!this.#positions||!this.#outcome)throw new Error("No completed tournament hand");
    const before=this.#hand.snapshot(null);
    if(before.handId!==expectedHandId||!before.result)throw new Error("Previous hand is not current and complete");
    if(this.#outcome.champion)throw new Error("Tournament already finished");
    const live=this.#order.filter(id=>(this.#outcome!.stacks[id]??0)>0);
    const positions=nextTournamentPositions(this.#order,live,this.#positions);
    const players=live.map(id=>({id,stack:this.#outcome!.stacks[id]}));
    const now=this.#readNow();
    const hand=new AuthoritativeHand(players,0,terms,{order:this.#order,positions});
    // Everything above validates before replacing the previous hand/receipt owner.
    this.#hand=hand;this.#completedAt=null;this.#positions=positions;this.#terms={...terms};this.#handNumber++;this.#armTurn(now);this.#revision++;
    return this.publicSnapshot();
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
    if(this.#tournament&&this.#hand&&!this.#outcome?.champion&&(this.#seats.get(n)?.stack??0)>0)throw new Error("Tournament survivor seat remains reserved");
    this.#seats.delete(n);this.#revision++;return this.publicSnapshot();
  }
}
