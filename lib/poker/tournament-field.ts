/** Multi-table tournament field (owner 2026/10/30: 20人以上、卓分け・移動・統合).
 * One tournament = one room = one durable owner; every table lives inside it, so a move between tables
 * is a single in-memory step committed with one checkpoint (no cross-room transfer can lose chips).
 * Rules: 6-max tables, random draw; between hands a table sheds busted players, breaks when the field
 * fits fewer tables, or sends its next big blind to the shortest table when it has 2+ more players;
 * a player moved into a live hand waits for the next one; places are decided across all tables;
 * the last table is the final table (extra time bank cards once). One change per advance() call.
 * Server-only: member IDs and checkpoints never reach browsers.
 */
import {randomInt,randomUUID} from 'node:crypto';
import {SeatedHandRoom,type RoomCheckpoint,type TurnDeadline} from './seated-hand-room';
import type {HandTerms} from './tournament-hand';
import {runoutDuration,PAYOUT_ANIMATION_MS} from './presentation-timing';

export const FIELD_TABLE_SIZE=6;
/** Owner 2026/10/31 (100人きたらええな): up to 100 players (17 tables of 6). */
export const FIELD_MAX_PLAYERS=100;
/** Rosters above this size use the field; 2–6 keep the single-table room. */
export const FIELD_MIN_PLAYERS=7;
export type FieldElimination={memberId:string;place:number;tiedThrough:number;comparisonStack:number;table:number;handId:string};
type Runout={handId:string;fromBoardCount:number};
export type FieldCheckpoint={version:1;entrants:string[];tables:[number,RoomCheckpoint][];eliminated:FieldElimination[];champion:string|null;finalGiven:boolean;
 clock:number;tableRevisions:[number,number][];fieldRevision:number;moved:[string,{from:number;to:number;at:number}][];finishedAt:number|null;settled:[number,string][];runouts:[number,Runout][]};
type TableOptions={startingStack:number;terms:HandTerms;turnMs:number;bankCards:number;finalTableCards:number;now:()=>number};
export type FieldSettlement={table:number;handId:string;handNumber:number};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function tableCountFor(players:number){return Math.ceil(players/FIELD_TABLE_SIZE);}
function shuffle<T>(items:readonly T[]){const out=[...items];for(let i=out.length-1;i>0;i--){const j=randomInt(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}

export class TournamentField {
 #tables=new Map<number,SeatedHandRoom>();#entrants:string[]=[];#eliminated:FieldElimination[]=[];#champion:string|null=null;#finalGiven=false;
 #clock=0;#tableRevisions=new Map<number,number>();#fieldRevision=0;#moved=new Map<string,{from:number;to:number;at:number}>();#finishedAt:number|null=null;
 #settled=new Map<number,string>();#runouts=new Map<number,Runout>();
 /** Busted players keep watching (not saved: they reconnect after a restart). */
 #watchers=new Map<string,{connectionId:string;table:number}>();
 /** The hand this operation settled, for the durable result record and hand history. */
 #justSettled:FieldSettlement|null=null;
 private constructor(private options:TableOptions){}
 #table(){return new SeatedHandRoom(this.options.startingStack,this.options.terms,{tournament:true,field:true,turnMs:this.options.turnMs,bankCards:this.options.bankCards,finalTableCards:this.options.finalTableCards,now:this.options.now});}
 /** Random draw: tables of as equal size as possible, random seats. */
 static draw(members:readonly string[],options:TableOptions){
  if(!Array.isArray(members)||members.length<FIELD_MIN_PLAYERS||members.length>FIELD_MAX_PLAYERS||new Set(members).size!==members.length||members.some(m=>typeof m!=='string'||!uuid.test(m)))throw new Error('Invalid field roster');
  const field=new TournamentField(options);field.#entrants=[...members].sort();
  const count=tableCountFor(members.length),order=shuffle(members);
  for(let t=1;t<=count;t++)field.#tables.set(t,field.#table());
  order.forEach((member,i)=>{const room=field.#tables.get(1+i%count)!;const free=[1,2,3,4,5,6].filter(n=>room.memberSeat(member)===null&&!room.fieldSeats().seats.some(s=>s.seat===n));room.seat(member,free[randomInt(free.length)]);});
  field.#bump([...field.#tables.keys()],true);
  return field;
 }
 checkpoint():FieldCheckpoint{
  return structuredClone({version:1 as const,entrants:this.#entrants,tables:[...this.#tables].map(([n,t])=>[n,t.checkpoint()] as [number,RoomCheckpoint]),eliminated:this.#eliminated,champion:this.#champion,finalGiven:this.#finalGiven,
   clock:this.#clock,tableRevisions:[...this.#tableRevisions],fieldRevision:this.#fieldRevision,moved:[...this.#moved],finishedAt:this.#finishedAt,settled:[...this.#settled],runouts:[...this.#runouts]});
 }
 static restore(input:FieldCheckpoint,options:TableOptions){
  const s=structuredClone(input);
  if(s?.version!==1||!Array.isArray(s.entrants)||s.entrants.length<FIELD_MIN_PLAYERS||s.entrants.length>FIELD_MAX_PLAYERS||new Set(s.entrants).size!==s.entrants.length||!Array.isArray(s.tables)||s.tables.length<1||s.tables.length>tableCountFor(FIELD_MAX_PLAYERS)||!Number.isSafeInteger(s.clock)||s.clock<0)throw new Error('Invalid field checkpoint');
  const field=new TournamentField(options);field.#entrants=[...s.entrants];
  for(const [n,c] of s.tables){if(!Number.isSafeInteger(n)||n<1||field.#tables.has(n)||c?.field!==true)throw new Error('Invalid field table');field.#tables.set(n,SeatedHandRoom.restore(c,options.now));}
  const seated=[...field.#tables.values()].flatMap(t=>t.fieldSeats().seats.map(x=>x.memberId));
  if(new Set(seated).size!==seated.length||seated.some(m=>!field.#entrants.includes(m)))throw new Error('Invalid field seating');
  field.#eliminated=s.eliminated.map(e=>({...e}));field.#champion=s.champion;field.#finalGiven=s.finalGiven===true;field.#clock=s.clock;
  field.#tableRevisions=new Map(s.tableRevisions);field.#fieldRevision=s.fieldRevision;field.#moved=new Map(s.moved);field.#finishedAt=s.finishedAt;field.#settled=new Map(s.settled);field.#runouts=new Map(s.runouts);
  return field;
 }
 #bump(tables:readonly number[],field=false){this.#clock++;for(const t of tables)this.#tableRevisions.set(t,this.#clock);if(field)this.#fieldRevision=this.#clock;}
 get finished(){return this.#champion!==null;}
 get finishedAt(){return this.#finishedAt;}
 get tableCount(){return this.#tables.size;}
 /** Clear the per-operation settlement marker (call at the start of every mutation). */
 beginOperation(){this.#justSettled=null;}
 get justSettled(){return this.#justSettled;}
 tableOf(member:string){for(const [n,t] of this.#tables)if(t.memberSeat(member)!==null)return n;return null;}
 room(table:number){const t=this.#tables.get(table);if(!t)throw new Error('Unknown table');return t;}
 /** Every seated player with chips, across tables (players busted this hand are already at 0). */
 remaining(){let n=0;for(const t of this.#tables.values())for(const s of t.fieldSeats().seats)if(s.stack>0)n++;return n;}
 placeOf(member:string){return this.#eliminated.find(e=>e.memberId===member)??null;}
 get champion(){return this.#champion;}
 get entrants(){return [...this.#entrants];}
 eliminated(){return this.#eliminated.map(e=>({...e}));}
 runout(table:number){const r=this.#runouts.get(table);return r?{...r}:null;}
 movedRecently(member:string,now:number){const m=this.#moved.get(member);return m&&now-m.at<15000?{from:m.from,to:m.to}:null;}
 /** A member's view only changes when their own table (or the field) changes. Always increases, also across a move. */
 revisionFor(member:string|null){
  if(member===null)return this.#clock;
  const t=this.tableOf(member)??this.#watchers.get(member)?.table??this.placeOf(member)?.table??null;
  return Math.max(this.#fieldRevision,t===null?0:this.#tableRevisions.get(t)??0);
 }
 /** Cheap push-channel hint: the view revision behind a connection, or null when unknown (then do a full read). */
 revisionForConnection(connection:string){
  for(const t of this.#tables.values()){const m=t.memberByConnection(connection);if(m)return this.revisionFor(m);}
  for(const [m,w] of this.#watchers)if(w.connectionId===connection)return this.revisionFor(m);
  return null;
 }
 /** Spectators see the lowest-numbered table (the final table at the end). */
 featuredTable(){return Math.min(...this.#tables.keys());}
 watcher(member:string){const w=this.#watchers.get(member);return w?{...w}:null;}
 /** Track the board count a showdown started from, per table (drives the pause before the next hand). */
 #transition<T>(table:number,operation:()=>T):T{
  const room=this.room(table),before=room.publicSnapshot().hand,result=operation(),after=room.publicSnapshot().hand,current=this.#runouts.get(table);
  if(after?.handId!==current?.handId)this.#runouts.delete(table);
  const from=before?.handId===after?.handId?(before?.board.length??0):0;
  if(after?.result?.showdown&&(before?.handId!==after.handId||!before.result)&&from<5)this.#runouts.set(table,{handId:after.handId,fromBoardCount:from});
  return result;
 }
 /** After a table changes: if its hand just ended, place the busted players across the field. */
 #afterTableChange(table:number,now:number){
  const room=this.room(table),info=room.fieldSeats();this.#bump([table]);
  if(info.live||!info.started||!info.handId||info.settledHandId!==info.handId||this.#settled.get(table)===info.handId)return;
  this.#settled.set(table,info.handId);
  const busts=info.busts.map(b=>({member:info.seats.find(s=>s.seat===b.seat)!.memberId,comparisonStack:b.comparisonStack}));
  const live=this.remaining();
  for(const b of busts){
   const larger=busts.filter(o=>o.comparisonStack>b.comparisonStack).length,same=busts.filter(o=>o.comparisonStack===b.comparisonStack).length,place=live+1+larger;
   this.#eliminated.push({memberId:b.member,place,tiedThrough:place+same-1,comparisonStack:b.comparisonStack,table,handId:info.handId});
  }
  this.#eliminated.sort((a,b)=>a.place-b.place);
  if(live===1){for(const t of this.#tables.values())for(const s of t.fieldSeats().seats)if(s.stack>0)this.#champion=s.memberId;this.#finishedAt=now;}
  const snapshot=room.publicSnapshot();
  this.#justSettled={table,handId:info.handId,handNumber:snapshot.handNumber};
  if(busts.length||this.#champion)this.#bump([table],true);
 }
 #pause(table:number,handPauseMs:number){const room=this.room(table),h=room.publicSnapshot().hand,r=this.#runouts.get(table);return r&&r.handId===h?.handId?Math.max(handPauseMs,runoutDuration(r.fromBoardCount)+PAYOUT_ANIMATION_MS+1000):handPauseMs;}
 #move(member:string,from:number,to:number,now:number){
  const source=this.room(from),dest=this.room(to),moved=source.removeSeat(member);
  dest.addSeat(member,moved.stack,moved.cards,moved.connectionId);
  this.#moved.set(member,{from,to,at:now});this.#bump([from,to],true);
 }
 #counts(){return new Map([...this.#tables].map(([n,t])=>[n,t.fieldSeats().seats.filter(s=>s.stack>0).length]));}
 /** One trusted decision. `terms` is null before the start and during breaks: no new hands then. */
 advance(now:number,terms:HandTerms|null,handPauseMs:number):{event:string;changed:boolean;nextWakeAt:number|null}{
  if(this.#champion)return {event:'finished',changed:false,nextWakeAt:null};
  let wake:number|null=null;const soon=(at:number)=>{wake=wake===null?at:Math.min(wake,at);};
  const order=[...this.#tables.keys()].sort((a,b)=>a-b);
  // 1. Turn deadlines first (a time bank card is spent automatically before any check/fold).
  for(const t of order){
   const room=this.room(t),turn=room.publicSnapshot().turn;if(!turn)continue;
   if(now>=turn.expiresAt){const r=this.#transition(t,()=>room.expireTurn(turn));this.#afterTableChange(t,now);return {event:r.expired?'timed-out':'time-bank',changed:true,nextWakeAt:now};}
   soon(turn.expiresAt);
  }
  // 2. Tables between hands: drop busted players, break / balance, final table cards, next hand.
  const counts=this.#counts(),live=[...counts.values()].reduce((a,b)=>a+b,0),target=Math.max(1,tableCountFor(live));
  const breaking=this.#tables.size>target?[...counts].sort((a,b)=>a[1]-b[1]||b[0]-a[0])[0][0]:null;
  for(const t of order){
   const room=this.room(t),info=room.fieldSeats();
   if(!info.seats.length){this.#tables.delete(t);this.#tableRevisions.delete(t);this.#settled.delete(t);this.#runouts.delete(t);this.#bump([],true);return {event:'table-closed',changed:true,nextWakeAt:now};}
   if(!info.started){
    if(!terms||info.seats.length<2)continue;
    const seats=info.seats.map(s=>s.seat);
    this.#transition(t,()=>room.startHandWithTerms(seats[randomInt(seats.length)],terms,true));this.#afterTableChange(t,now);
    return {event:'started',changed:true,nextWakeAt:now};
   }
   if(info.live)continue;
   const due=(info.completedAt??now)+this.#pause(t,handPauseMs);
   if(now<due){soon(due);continue;}
   const busted=info.seats.find(s=>s.stack===0);
   if(busted){const removed=room.removeSeat(busted.memberId);if(removed.connectionId)this.#watchers.set(busted.memberId,{connectionId:removed.connectionId,table:t});this.#bump([t],true);return {event:'busted-out',changed:true,nextWakeAt:now};}
   // Destinations need a physical free seat (busted players may still sit there until their table moves on).
   const mine=counts.get(t)??0,others=order.filter(o=>o!==t&&o!==breaking&&this.room(o).fieldSeats().seats.length<FIELD_TABLE_SIZE).sort((a,b)=>(counts.get(a)??0)-(counts.get(b)??0)||a-b);
   if(t===breaking&&others.length){this.#move(info.seats[0].memberId,t,others[0],now);return {event:'table-break',changed:true,nextWakeAt:now};}
   const shortest=others[0];
   if(shortest!==undefined&&breaking===null&&mine-(counts.get(shortest)??0)>=2){
    const member=room.nextBigBlindMember()??info.seats[0].memberId;this.#move(member,t,shortest,now);return {event:'balanced',changed:true,nextWakeAt:now};
   }
   if(this.#tables.size===1&&!this.#finalGiven&&live<=FIELD_TABLE_SIZE){this.#finalGiven=true;if(this.options.finalTableCards>0){room.grantCards(this.options.finalTableCards);this.#bump([t]);return {event:'final-table',changed:true,nextWakeAt:now};}}
   if(!terms||mine<2)continue;
   this.#transition(t,()=>room.nextHand(info.handId!,terms));this.#afterTableChange(t,now);
   return {event:'next-hand',changed:true,nextWakeAt:now};
  }
  return {event:'playing',changed:false,nextWakeAt:wake};
 }
 // ---- Player operations (identity already verified; member IDs are trusted context) ----
 join(member:string){
  const t=this.tableOf(member);
  if(t!==null){const r=this.room(t).join(member,false);this.#bump([t]);return {...r,table:t};}
  if(!this.#entrants.includes(member))throw new Error('Not in this tournament');
  const place=this.placeOf(member);if(!place)throw new Error('Member is not seated');
  const connectionId=randomUUID(),table=this.#tables.has(place.table)?place.table:this.featuredTable();
  this.#watchers.set(member,{connectionId,table});return {connectionId,table,watching:true as const};
 }
 /** Route a connection-bound operation to the member's table (or their watcher seat). */
 locate(member:string,connection:string):{table:number;watching:boolean}{
  const t=this.tableOf(member);if(t!==null)return {table:t,watching:false};
  const w=this.#watchers.get(member);if(!w||w.connectionId!==connection)throw new Error('Connection is not current');
  return {table:this.#tables.has(w.table)?w.table:this.featuredTable(),watching:true};
 }
 disconnect(member:string,connection:string){
  const at=this.locate(member,connection);
  if(at.watching){this.#watchers.delete(member);return;}
  this.room(at.table).disconnect(member,connection);this.#bump([at.table]);
 }
 disconnectConnection(connection:string){
  for(const [n,t] of this.#tables)if(t.hasConnection(connection)){t.disconnectConnection(connection);this.#bump([n]);return true;}
  for(const [m,w] of this.#watchers)if(w.connectionId===connection){this.#watchers.delete(m);return false;}
  return false;
 }
 act(member:string,connection:string,payload:unknown,now:number){
  const at=this.locate(member,connection);if(at.watching)throw new Error('Watching only');
  const room=this.room(at.table),r=this.#transition(at.table,()=>room.act(member,connection,payload));
  if(!r.replayed)this.#afterTableChange(at.table,now);return {...r,table:at.table};
 }
 timeBank(member:string,connection:string,handId:string,revision:number,requestId:string|undefined){
  const at=this.locate(member,connection);if(at.watching)throw new Error('Watching only');
  const r=this.room(at.table).timeBank(member,connection,handId,revision,requestId);if(!r.replayed)this.#bump([at.table]);return {...r,table:at.table};
 }
 expireTurn(expected:TurnDeadline,now:number){
  for(const [n,t] of this.#tables){const turn=t.publicSnapshot().turn;if(turn&&turn.handId===expected.handId){const r=this.#transition(n,()=>t.expireTurn(expected));if(r.expired||(r as {banked?:boolean}).banked)this.#afterTableChange(n,now);return {...r,table:n};}}
  return {expired:false,table:null};
 }
 /** Hand history for the hand settled by this operation (members by seat at that table). */
 settledHistory(){
  const s=this.#justSettled;if(!s)return null;const room=this.#tables.get(s.table);if(!room)return null;
  const c=room.checkpoint();if(!c.hand||c.hand.id!==s.handId)return null;
  return {hand:c.hand,members:Object.fromEntries(c.seats.map(([n,p])=>[`seat-${n}`,p.memberId])),handNumber:s.handNumber};
 }
 /** Durable result for the hand settled by this operation. The last hand also carries the final standings
  * (opaque entry ids e-1…e-N; the archive maps them to members inside the database). */
 terminalResult(){
  const s=this.#justSettled;if(!s)return null;const room=this.#tables.get(s.table);if(!room)return null;
  const h=room.publicSnapshot().hand;if(!h?.result||h.handId!==s.handId)return null;
  const base={handId:h.handId,handNumber:s.handNumber,table:s.table,payouts:h.result.payouts,winners:h.result.winners};
  if(!this.#champion)return {...base,showdown:h.result.showdown};
  const id=(m:string)=>`e-${this.#entrants.indexOf(m)+1}`;
  return {...base,tournament:{champion:id(this.#champion),eliminated:this.#eliminated.map(e=>({id:id(e.memberId),place:e.place,tiedThrough:e.tiedThrough}))},participants:this.#entrants.map(m=>({seatId:id(m),memberId:m}))};
 }
}
