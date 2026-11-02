/** Server-owned room with optional tournament continuation. Member IDs are trusted context,
 * never client payload fields. One owner per room; checkpoint primitives do not install persistence/transport.
 */
import { randomUUID, randomInt } from "node:crypto";
import { AuthoritativeHand, type HandCheckpoint } from "./authoritative-hand";
import type { HandTerms } from "./tournament-hand";
import { initialTournamentPositions,nextTournamentPositions,type TournamentPositions,type TournamentOutcome } from "./tournament-table";

export type TurnDeadline={handId:string;revision:number;actor:string;expiresAt:number};
type Seat={memberId:string;stack:number;connectionId:string|null};
export type RoomCheckpoint={version:1;seats:[number,{memberId:string;stack:number}][];hand:HandCheckpoint|null;revision:number;startingStack:number;terms:HandTerms;tournament:boolean;positions:TournamentPositions|null;outcome:TournamentOutcome|null;settledHandId:string|null;handNumber:number;turn:TurnDeadline|null;turnMs:number;lastNow:number;completedAt?:number|null;timeBanks?:[string,number][];timeBankCards?:[string,number][];timeBankUses?:[string,{revision:number;ids:string[]}][];bankPolicy?:{cards:number;finalTableCards:number;finalTableSize:number;finalTableGiven:boolean};field?:boolean};
/** Ring/single-hand: one free +20s per hand. Tournament: time bank cards; one card adds one turn's worth of time. */
export const BANK_USE_MS=20000;
export class SeatedHandRoom {
  #seats=new Map<number,Seat>(); #hand:AuthoritativeHand|null=null; #revision=0;
  #startingStack:number; #terms:HandTerms;
  #tournament:boolean; #positions:TournamentPositions|null=null; #outcome:TournamentOutcome|null=null;
  #settledHandId:string|null=null; #handNumber=0; #completedAt:number|null=null;
  #timeBanks=new Map<string,number>();
  /** Tournament only: each seat's saved time bank (ms) and the extension granted on the current turn. */
  #cards=new Map<string,number>(); #bankUses=new Map<string,{revision:number;ids:string[]}>(); #bank={cards:0,finalTableCards:0,finalTableSize:6,finalTableGiven:false};
  #order=Array.from({length:6},(_,i)=>`seat-${i+1}`);
  /** One table of a multi-table tournament (2026/10/30): places and the champion are decided across tables by the owner,
   * players can be moved in and out between hands, and a moved-in player waits for the next hand. */
  #field=false;
  #turn:TurnDeadline|null=null; #now:()=>number; #turnMs:number; #lastNow=0;
  constructor(startingStack:number,terms:HandTerms,options:{now?:()=>number;turnMs?:number;tournament?:boolean;bankCards?:number;finalTableCards?:number;finalTableSize?:number;field?:boolean}={}) {
    if(!Number.isSafeInteger(startingStack)||startingStack<1||startingStack>Math.floor(Number.MAX_SAFE_INTEGER/6))throw new Error("Invalid starting stack");
    if(options.tournament!==undefined&&typeof options.tournament!=="boolean")throw new Error("Invalid tournament policy");
    this.#tournament=options.tournament??false;
    const turnMs=options.turnMs??20000;
    if(!Number.isSafeInteger(turnMs)||turnMs<1||turnMs>300000||(options.now!==undefined&&typeof options.now!=="function"))throw new Error("Invalid server clock policy");
    this.#startingStack=startingStack;this.#terms={...terms};this.#turnMs=turnMs;this.#now=options.now??Date.now;
    const cards=options.bankCards??0,ft=options.finalTableCards??0,size=options.finalTableSize??6;
    if(!Number.isSafeInteger(cards)||cards<0||cards>5||!Number.isSafeInteger(ft)||ft<0||ft>5||![2,6].includes(size))throw new Error("Invalid time bank policy");
    this.#bank={cards,finalTableCards:ft,finalTableSize:size,finalTableGiven:false};
    if(options.field!==undefined&&(typeof options.field!=='boolean'||options.field&&!this.#tournament))throw new Error("Invalid table policy");
    this.#field=options.field??false;
  }
  /** Server-only checkpoint; connection capabilities are deliberately omitted. */
  checkpoint():RoomCheckpoint {
    return structuredClone({version:1,seats:[...this.#seats].map(([n,s])=>[n,{memberId:s.memberId,stack:s.stack}]),hand:this.#hand?.checkpoint()??null,revision:this.#revision,startingStack:this.#startingStack,terms:this.#terms,tournament:this.#tournament,positions:this.#positions,outcome:this.#outcome,settledHandId:this.#settledHandId,handNumber:this.#handNumber,turn:this.#turn,turnMs:this.#turnMs,lastNow:this.#lastNow,completedAt:this.#completedAt,timeBanks:[...this.#timeBanks],timeBankCards:[...this.#cards],timeBankUses:[...this.#bankUses].map(([id,u])=>[id,{revision:u.revision,ids:[...u.ids]}]),bankPolicy:{...this.#bank},...(this.#field?{field:true}:{})});
  }
  /** Only load an authenticated/decrypted server checkpoint. Restored sockets must reconnect. */
  static restore(input:RoomCheckpoint,now:()=>number=Date.now) {
    const s=structuredClone(input);
    if(s?.version!==1||!Array.isArray(s.seats)||s.seats.length>6||!Number.isSafeInteger(s.revision)||s.revision<0||!Number.isSafeInteger(s.lastNow)||s.lastNow<0)throw new Error("Invalid room checkpoint");
    if(s.field!==undefined&&(s.field!==true||!s.tournament))throw new Error("Invalid room checkpoint");
    const room=new SeatedHandRoom(s.startingStack,s.terms,{now,turnMs:s.turnMs,tournament:s.tournament,field:s.field===true});
    const members=new Set<string>();
    for(const [n,seat] of s.seats){room.seat(seat.memberId,n);if(members.has(seat.memberId)||!Number.isSafeInteger(seat.stack)||seat.stack<0)throw new Error("Invalid saved seat");members.add(seat.memberId);room.#seats.set(n,{...seat,connectionId:null});}
    room.#hand=s.hand?AuthoritativeHand.restore(s.hand):null;room.#revision=s.revision;room.#positions=s.positions;room.#outcome=s.outcome;room.#settledHandId=s.settledHandId;room.#handNumber=s.handNumber;room.#turn=s.turn;room.#lastNow=s.lastNow;
    for(const [id,revision] of s.timeBanks??[]){if(!room.#seats.has(Number(id.replace('seat-','')))||!/^seat-[1-6]$/.test(id)||!Number.isSafeInteger(revision)||revision<0||room.#timeBanks.has(id))throw new Error("Invalid saved time bank");room.#timeBanks.set(id,revision);}
    if(s.bankPolicy){const b=s.bankPolicy;if(!Number.isSafeInteger(b.cards)||b.cards<0||b.cards>5||!Number.isSafeInteger(b.finalTableCards)||b.finalTableCards<0||b.finalTableCards>5||![2,6].includes(b.finalTableSize)||typeof b.finalTableGiven!=='boolean')throw new Error("Invalid saved time bank");room.#bank={...b};}
    for(const [id,count] of s.timeBankCards??[]){if(!s.tournament||!/^seat-[1-6]$/.test(id)||!room.#seats.has(Number(id.slice(5)))||!Number.isSafeInteger(count)||count<0||count>10)throw new Error("Invalid saved time bank");room.#cards.set(id,count);}
    for(const [id,u] of s.timeBankUses??[]){if(!s.tournament||!/^seat-[1-6]$/.test(id)||!Number.isSafeInteger(u?.revision)||!Array.isArray(u.ids)||u.ids.length>10||u.ids.some(x=>typeof x!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(x)))throw new Error("Invalid saved time bank");room.#bankUses.set(id,{revision:u.revision,ids:[...u.ids]});}
    // Checkpoints from before cards existed: everyone still seated gets the starting cards.
    if(s.tournament&&s.timeBankCards===undefined)for(const [n] of room.#seats)room.#cards.set(`seat-${n}`,room.#bank.cards);
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
    if(this.#field){
     // This hand's busts only (table-local places are replaced by the owner's field-wide places).
     const outcome=this.#hand!.finishTournament([]);
     for(const [n,s] of this.#seats){const id=`seat-${n}`;if(id in outcome.stacks)s.stack=outcome.stacks[id];}
     const stacks=Object.fromEntries([...this.#seats].map(([n,s])=>[`seat-${n}`,s.stack]));
     this.#outcome={stacks,liveIds:this.#order.filter(id=>(stacks[id]??0)>0),eliminated:outcome.eliminated,champion:null};this.#settledHandId=h.handId;return;
    }
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
  #bankView(id:string|null){
    if(!this.#tournament)return {seconds:20,remaining:id&&!this.#timeBanks.has(id)?1:0};
    const cards=id?this.#cards.get(id)??0:0;
    return {seconds:Math.round(this.#turnMs/1000),remaining:cards>0?1:0,cards};
  }
  /** Final table extra cards: once, when the players left fit one final table. */
  #finalTable(live:readonly string[]){
    if(!this.#tournament||this.#field||this.#bank.finalTableGiven||this.#bank.finalTableCards<1||live.length>this.#bank.finalTableSize)return;
    this.#bank.finalTableGiven=true;for(const id of live)this.#cards.set(id,Math.min(10,(this.#cards.get(id)??0)+this.#bank.finalTableCards));
  }
  #snapshot(viewerSeat:number|null) {
    const publicHand=this.#hand?.snapshot(null)??null;
    const id=viewerSeat===null?null:`seat-${viewerSeat}`;
    const hand=id&&publicHand?.players.some(p=>p.id===id)?this.#hand!.snapshot(id):publicHand;
    const outcome=this.#outcome?{...this.#outcome,stacks:{...this.#outcome.stacks},liveIds:[...this.#outcome.liveIds],eliminated:this.#outcome.eliminated.map(p=>({...p}))}:null;
    return {revision:this.#revision,mode:this.#tournament?"tournament":"single-hand",phase:outcome?.champion?"finished":hand?.result?"complete":hand?"playing":"waiting",handNumber:this.#handNumber,completedAt:this.#completedAt,tournament:outcome,youSeat:viewerSeat,timeBank:this.#bankView(id),turnDurationMs:this.#turnMs+(this.#turn&&this.#timeBanks.get(this.#turn.actor)===this.#turn.revision?(this.#tournament?this.#turnMs*Math.max(1,this.#bankUses.get(this.#turn.actor)?.revision===this.#turn.revision?this.#bankUses.get(this.#turn.actor)!.ids.length:1):BANK_USE_MS):0),turn:this.#turn?{...this.#turn}:null,
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
  /** Initial roster includes only admitted members who actually took a seat.
   * Previously seated disconnected players remain and time out normally. */
  seatedRegistrationReady(members:readonly string[]){return [...this.#seats.values()].filter(s=>members.includes(s.memberId)).length>=2;}
  startSeatedRegisteredHand(members:readonly string[],terms:HandTerms){
    if(this.#hand||!this.seatedRegistrationReady(members))throw Error("Require two seated participants");
    for(const [number,seat] of this.#seats)if(!members.includes(seat.memberId)){this.#seats.delete(number);this.#revision++;}
    const seats=[...this.#seats.keys()].sort((a,b)=>a-b);
    return this.startHandWithTerms(seats[randomInt(seats.length)],terms,true);
  }
  startRegisteredHand(members:readonly string[],terms:HandTerms) {
    if(!this.registrationReadiness(members).ready)throw new Error("Starting roster not ready");
    const seats=[...this.#seats.keys()].sort((a,b)=>a-b);
    return this.startHandWithTerms(seats[randomInt(seats.length)],terms);
  }
  startHand(buttonSeat:number) {return this.startHandWithTerms(buttonSeat,this.#terms);}
  /** Trusted schedule wrapper may select the current level at INITIAL deal time. */
  startHandWithTerms(buttonSeat:number,terms:HandTerms,allowDisconnected=false) {
    if(this.#hand)throw new Error("Hand already started");
    const entries=[...this.#seats].sort((a,b)=>a[0]-b[0]);
    if(entries.length<2||!this.#seats.has(buttonSeat)||(!allowDisconnected&&entries.some(([,s])=>!s.connectionId)))throw new Error("Players are not ready");
    const now=this.#readNow();
    const players=entries.map(([n,s])=>({id:`seat-${n}`,stack:s.stack}));
    const positions=this.#tournament?initialTournamentPositions(this.#order,players.map(p=>p.id),`seat-${buttonSeat}`):null;
    const hand=new AuthoritativeHand(players,entries.findIndex(([n])=>n===buttonSeat),terms,positions?{order:this.#order,positions}:undefined);
    this.#hand=hand;this.#timeBanks.clear();this.#bankUses.clear();if(this.#tournament){if(!this.#field)this.#cards.clear();this.#bank.finalTableGiven=false;for(const p of players)if(!this.#field||!this.#cards.has(p.id))this.#cards.set(p.id,this.#bank.cards);this.#finalTable(players.map(p=>p.id));}this.#completedAt=null;this.#positions=positions;this.#terms={...terms};this.#handNumber=1;this.#armTurn(now);this.#revision++;return this.publicSnapshot();
  }
  /** Trusted tournament scheduler only. A captured completed hand ID makes retries safe.
   * Survivors carry stacks; disconnected survivors remain in play with server deadlines.
   */
  nextHand(expectedHandId:string,terms:HandTerms=this.#terms) {
    if(!this.#tournament||!this.#hand||!this.#positions||!this.#outcome)throw new Error("No completed tournament hand");
    const before=this.#hand.snapshot(null);
    if(before.handId!==expectedHandId||!before.result)throw new Error("Previous hand is not current and complete");
    if(this.#outcome.champion)throw new Error("Tournament already finished");
    const stackOf=(id:string)=>this.#field?(this.#seats.get(Number(id.slice(5)))?.stack??0):(this.#outcome!.stacks[id]??0);
    const live=this.#order.filter(id=>stackOf(id)>0);
    const positions=nextTournamentPositions(this.#order,live,this.#positions);
    const players=live.map(id=>({id,stack:stackOf(id)}));
    const now=this.#readNow();
    const hand=new AuthoritativeHand(players,0,terms,{order:this.#order,positions});
    // Everything above validates before replacing the previous hand/receipt owner.
    this.#hand=hand;this.#timeBanks.clear();this.#bankUses.clear();this.#completedAt=null;this.#positions=positions;this.#terms={...terms};this.#handNumber++;
    for(const id of [...this.#cards.keys()])if(!live.includes(id))this.#cards.delete(id);
    this.#finalTable(live);
    this.#armTurn(now);this.#revision++;
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
  /** Ring: one server-owned +20s per player per hand. Tournament: time bank cards, as many per turn as the
   * player has; each request id spends one card. A repeated request (lost acknowledgement) is a read-only replay. */
  timeBank(member:string,connection:string,handId:string,revision:number,requestId?:string){
    const [n]=this.#connection(member,connection),id=`seat-${n}`,h=this.#hand?.snapshot(null),t=this.#turn;
    if(!h||h.handId!==handId||!Number.isSafeInteger(revision)||revision<0)throw new Error("Invalid time bank turn");
    if(requestId!==undefined&&(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(requestId)))throw new Error("Invalid time bank request");
    const uses=this.#bankUses.get(id),multi=this.#tournament&&requestId!==undefined;
    if(multi?uses?.revision===revision&&uses.ids.includes(requestId!):this.#timeBanks.get(id)===revision)return {replayed:true,state:this.#snapshot(n)};
    const now=this.#readNow();
    // Ring/single-hand: one +20s per hand. Tournament: one card = one turn's time; older clients use one per turn.
    const grant=this.#tournament?((this.#cards.get(id)??0)>0?this.#turnMs:0):BANK_USE_MS;
    if(!t||t.actor!==id||t.revision!==revision||h.result||now>=t.expiresAt||grant<=0||(!this.#tournament&&this.#timeBanks.has(id))||(this.#tournament&&!multi&&this.#timeBanks.get(id)===revision)||(uses?.revision===revision&&uses.ids.length>=10)||!Number.isSafeInteger(t.expiresAt+grant))throw new Error("Time bank unavailable");
    this.#timeBanks.set(id,revision);this.#turn={...t,expiresAt:t.expiresAt+grant};this.#revision++;
    if(this.#tournament){this.#cards.set(id,(this.#cards.get(id)??0)-1);const key=requestId??`legacy-${revision}`;this.#bankUses.set(id,uses?.revision===revision?{revision,ids:[...uses.ids,key]}:{revision,ids:[key]});}
    return {replayed:false,state:this.#snapshot(n)};
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
    // Tournament: a time bank card is used automatically before anything is checked or folded, one card at a time.
    const cards=this.#tournament?this.#cards.get(t.actor)??0:0;
    if(cards>0&&Number.isSafeInteger(t.expiresAt+this.#turnMs)){
     const uses=this.#bankUses.get(t.actor),ids=uses?.revision===t.revision?uses.ids:[];
     this.#cards.set(t.actor,cards-1);this.#bankUses.set(t.actor,{revision:t.revision,ids:[...ids,`auto-${t.revision}-${ids.length}`]});this.#timeBanks.set(t.actor,t.revision);
     this.#turn={...t,expiresAt:t.expiresAt+this.#turnMs};this.#revision++;
     return {expired:false,banked:true,state:this.publicSnapshot()};
    }
    const hand=this.#hand!;
    const legal=hand.snapshot(t.actor).legal;
    if(!legal)throw new Error("Timer actor is not actionable");
    const action={type:legal.check?"check" as const:"fold" as const};
    hand.act(t.actor,{handId:t.handId,revision:t.revision,actionId:"timeout_"+randomUUID(),action});
    this.#revision++;this.#armTurn(now);
    return {expired:true,action:action.type,state:this.publicSnapshot()};
  }
  /** Field table (trusted owner only): who sits where, with stacks. Member IDs stay on the server. */
  fieldSeats(){
    if(!this.#field)throw new Error("Not a field table");
    const h=this.#hand?.snapshot(null)??null;
    return {seats:[...this.#seats].sort((a,b)=>a[0]-b[0]).map(([n,s])=>({seat:n,memberId:s.memberId,stack:s.stack,cards:this.#cards.get(`seat-${n}`)??0,connected:Boolean(s.connectionId),inHand:Boolean(h&&!h.result&&h.players.some(p=>p.id===`seat-${n}`))})),
      handId:h?.handId??null,live:Boolean(h&&!h.result),settledHandId:this.#settledHandId,completedAt:this.#completedAt,started:this.#hand!==null,
      busts:this.#field&&this.#outcome&&h?.result&&this.#settledHandId===h.handId?this.#outcome.eliminated.map(e=>({seat:Number(e.id.slice(5)),comparisonStack:e.comparisonStack})):[]};
  }
  /** Who is due the big blind next hand (the player a balancing move takes), or null before a first hand. */
  nextBigBlindMember(){
    if(!this.#field||!this.#positions)return null;
    const live=this.#order.filter(id=>(this.#seats.get(Number(id.slice(5)))?.stack??0)>0);
    if(live.length<2)return null;
    const bb=nextTournamentPositions(this.#order,live,this.#positions).bb;
    return this.#seats.get(Number(bb.slice(5)))?.memberId??null;
  }
  /** Take a player off this table between hands (a move, or a bust). Their connection moves with them. */
  removeSeat(memberId:string){
    if(!this.#field)throw new Error("Not a field table");
    const entry=this.#member(memberId);if(!entry)throw new Error("Member is not seated");
    const h=this.#hand?.snapshot(null);
    if(h&&!h.result)throw new Error("Cannot move a player during a live hand");
    if(h?.result&&this.#settledHandId!==h.handId)this.#syncSettlement();
    const [n,seat]=entry,id=`seat-${n}`,cards=this.#cards.get(id)??0;
    this.#seats.delete(n);this.#cards.delete(id);this.#timeBanks.delete(id);this.#bankUses.delete(id);
    if(this.#outcome){delete this.#outcome.stacks[id];this.#outcome.liveIds=this.#outcome.liveIds.filter(x=>x!==id);}
    this.#revision++;
    return {seat:n,stack:seat.stack,cards,connectionId:seat.connectionId};
  }
  /** Seat a moved player on a free seat; during a live hand here they wait for the next one. */
  addSeat(memberId:string,stack:number,cards:number,connectionId:string|null,seatNumber?:number){
    if(!this.#field)throw new Error("Not a field table");
    if(this.#member(memberId))throw new Error("Member already seated");
    if(!Number.isSafeInteger(stack)||stack<1||!Number.isSafeInteger(cards)||cards<0||cards>10||(connectionId!==null&&typeof connectionId!=="string"))throw new Error("Invalid moved seat");
    const free=this.#order.map((_,i)=>i+1).filter(n=>!this.#seats.has(n));
    const n=seatNumber??free[randomInt(free.length||1)];
    if(!free.length||!free.includes(n))throw new Error("Table full");
    this.#seats.set(n,{memberId,stack,connectionId});this.#cards.set(`seat-${n}`,cards);
    if(this.#outcome&&!this.#hand?.snapshot(null).players.some(p=>p.id===`seat-${n}`)){this.#outcome.stacks[`seat-${n}`]=stack;this.#outcome.liveIds=this.#order.filter(id=>(this.#outcome!.stacks[id]??0)>0);}
    this.#revision++;
    return n;
  }
  /** Final table: extra time bank cards for everyone still in (once, decided by the owner). */
  grantCards(count:number){
    if(!this.#field||!Number.isSafeInteger(count)||count<1||count>5)throw new Error("Invalid card grant");
    for(const [n] of this.#seats){const id=`seat-${n}`;this.#cards.set(id,Math.min(10,(this.#cards.get(id)??0)+count));}
    this.#revision++;
  }
  /** Who holds this connection (transport routing only). */
  hasConnection(connectionId:string){return [...this.#seats.values()].some(s=>s.connectionId===connectionId);}
  memberByConnection(connectionId:string){return [...this.#seats.values()].find(s=>s.connectionId===connectionId)?.memberId??null;}
  memberSeat(memberId:string){return this.#member(memberId)?.[0]??null;}
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
