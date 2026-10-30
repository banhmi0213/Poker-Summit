/** Trusted schedule wrapper around an in-process authoritative tournament room.
 * No network/authentication or automatic persistence is installed here. All time is server-owned.
 */
import { SeatedHandRoom, type TurnDeadline, type RoomCheckpoint } from "./seated-hand-room";
import { tournamentClock,tournamentTiming,validateStructure,type TournamentStructure } from "./tournament";
import {runoutDuration,PAYOUT_ANIMATION_MS} from './presentation-timing';
import { tournamentHandTerms } from "./tournament-hand";
import { TournamentField,FIELD_MAX_PLAYERS,FIELD_MIN_PLAYERS,type FieldCheckpoint } from "./tournament-field";

type RoomSnapshot=ReturnType<SeatedHandRoom["publicSnapshot"]>;
export type TournamentControl={enabled:boolean;published:boolean;members:readonly string[];expectedCount:number;seatedStart?:boolean};
export type ScheduledCheckpoint={version:1;structure:TournamentStructure;startsAt:string;lastNow:number;room:RoomCheckpoint;handPauseMs?:number;seatedStart?:boolean;runout?:{handId:string;fromBoardCount:number};
 /** Multi-table tournaments (7+ players): every table lives here; `room` stays the unused empty single table. */
 field?:FieldCheckpoint};
/** Multi-table extras on a projected state (absent for single-table rooms). */
export type FieldView={tableNumber:number|null;tables:number;remaining:number;entrants:number;place:number|null;tiedThrough:number|null;champion:boolean;finalTable:boolean;moved:{from:number;to:number}|null;watching:boolean};
export class ScheduledTournamentRoom {
  #room:SeatedHandRoom; #structure:TournamentStructure; #startsAt:string;
  #clock:()=>number; #lastNow=0; #sample:number|null=null; #turnMs:number; #handPauseMs:number; #seatedStart=false;#runout:{handId:string;fromBoardCount:number}|undefined;
  #field:TournamentField|null=null;#timing:{timeBankCards:number;finalTableCards:number};
  constructor(config:{structure:unknown;starts_at:string},options:{now?:()=>number;turnMs?:number;handPauseMs?:number}={}) {
    const normalized=validateStructure(config.structure),start=Date.parse(config.starts_at);
    if(typeof config.starts_at!=="string"||!Number.isSafeInteger(start)||start<0)throw new Error("Invalid tournament start");
    if(options.now!==undefined&&typeof options.now!=="function")throw new Error("Invalid server clock");
    // Explicit copy/allow-list: unknown configuration fields are not broadcast.
    this.#structure={startingStack:normalized.startingStack,anteType:normalized.anteType,lateRegLevel:normalized.lateRegLevel,reentry:normalized.reentry,
      periods:normalized.periods.map(p=>({kind:p.kind,minutes:p.minutes,sb:p.sb,bb:p.bb,ante:p.ante,note:p.note})),
      ...(normalized.turnSeconds!==undefined?{turnSeconds:normalized.turnSeconds}:{}),...(normalized.timeBankCards!==undefined?{timeBankCards:normalized.timeBankCards}:{}),...(normalized.finalTableCards!==undefined?{finalTableCards:normalized.finalTableCards}:{})};
    const timing=tournamentTiming(normalized);
    this.#startsAt=new Date(start).toISOString();this.#clock=options.now??Date.now;this.#turnMs=options.turnMs??timing.turnSeconds*1000;
    this.#handPauseMs=options.handPauseMs??8000;
    if(!Number.isSafeInteger(this.#handPauseMs)||this.#handPauseMs<0||this.#handPauseMs>60000)throw new Error("Invalid hand pause");
    this.#timing={timeBankCards:timing.timeBankCards,finalTableCards:timing.finalTableCards};
    const first=this.#structure.periods[0];
    this.#room=new SeatedHandRoom(this.#structure.startingStack,{level:1,index:0,sb:first.sb,bb:first.bb,ante:first.ante,anteType:this.#structure.anteType},
      {tournament:true,turnMs:this.#turnMs,bankCards:timing.timeBankCards,finalTableCards:timing.finalTableCards,now:()=>this.#sample??this.#readNow()});
  }
  /** Sensitive server-only checkpoint. No live connection tokens. */
  checkpoint():ScheduledCheckpoint {return structuredClone({version:1,structure:this.#structure,startsAt:this.#startsAt,lastNow:this.#lastNow,room:this.#room.checkpoint(),handPauseMs:this.#handPauseMs,...(this.#runout?{runout:this.#runout}:{}),...(this.#seatedStart?{seatedStart:true}:{}),...(this.#field?{field:this.#field.checkpoint()}:{})});}
  static restore(input:ScheduledCheckpoint,options:{now?:()=>number}={}) {
    const s=structuredClone(input);
    if(s?.version!==1||!Number.isSafeInteger(s.lastNow)||s.lastNow<0||!s.room?.tournament||s.room.startingStack!==s.structure?.startingStack)throw new Error("Invalid scheduled checkpoint");
    const room=new ScheduledTournamentRoom({structure:s.structure,starts_at:s.startsAt},{now:options.now,turnMs:s.room.turnMs,handPauseMs:s.handPauseMs===4000?8000:s.handPauseMs});
    if(s.seatedStart!==undefined&&typeof s.seatedStart!=="boolean")throw Error("Invalid seated start policy");room.#seatedStart=s.seatedStart??false;room.#lastNow=s.lastNow;room.#room=SeatedHandRoom.restore(s.room,()=>room.#sample??room.#readNow());if(s.field)room.#field=TournamentField.restore(s.field,room.#fieldOptions());if(s.runout){const h=room.#room.publicSnapshot().hand;if(!h?.result?.showdown||h.handId!==s.runout.handId||![0,3,4].includes(s.runout.fromBoardCount))throw Error('Invalid runout checkpoint');room.#runout=s.runout;}return room;
  }
  #fieldOptions(){const first=this.#structure.periods[0];return {startingStack:this.#structure.startingStack,terms:{level:1,index:0,sb:first.sb,bb:first.bb,ante:first.ante,anteType:this.#structure.anteType},turnMs:this.#turnMs,bankCards:this.#timing.timeBankCards,finalTableCards:this.#timing.finalTableCards,now:()=>this.#sample??this.#readNow()};}
  /** Multi-table only: the view revision behind a connection, for skipping push re-reads of other tables (null = read). */
  revisionHint(connection:string){return this.#field?.revisionForConnection(connection)??null;}
  /** True once a 7+ player roster has been drawn onto tables. */
  get multiTable(){return this.#field!==null;}
  /** Project one table of the field for a member (or a spectator), with the field-wide extras. */
  #projectField(table:number,state:RoomSnapshot,now:number,member:string|null,watching=false){
    const f=this.#field!,place=member?f.placeOf(member):null,finished=f.finished;
    const c=tournamentClock(this.#structure,this.#startsAt,finished?(f.finishedAt??now):now);
    const outcome=state.tournament,champ=f.champion;
    const championSeat=champ&&f.tableOf(champ)===table?`seat-${f.room(table).memberSeat(champ)}`:null;
    const field:FieldView={tableNumber:table,tables:f.tableCount,remaining:f.remaining(),entrants:f.entrants.length,place:place?.place??(member&&champ===member?1:null),tiedThrough:place?.tiedThrough??(member&&champ===member?1:null),
      champion:Boolean(member&&champ===member),finalTable:f.tableCount===1,moved:member?f.movedRecently(member,now):null,watching};
    const runout=f.runout(table);
    return {...state,revision:f.revisionFor(watching?null:member),youSeat:watching?null:state.youSeat,phase:finished?'finished' as const:state.phase,
      tournament:outcome?{stacks:{...outcome.stacks},liveIds:[...outcome.liveIds],eliminated:[],champion:championSeat}:null,
      autoExitAt:finished&&f.finishedAt!==null?f.finishedAt+600000:null,runout:runout&&runout.handId===state.hand?.handId?runout:null,serverNow:now,startsAt:this.#startsAt,structure:structuredClone(this.#structure),
      clock:{...c,period:{...c.period},next:c.next?{...c.next}:null,following:this.#structure.periods[c.index+1]?{...this.#structure.periods[c.index+1]}:null},canStartHand:false,field};
  }
  #fieldTerms(now:number){const c=tournamentClock(this.#structure,this.#startsAt,now);if(c.phase==='scheduled'||c.phase==='break')return null;return tournamentHandTerms({structure:this.#structure,starts_at:this.#startsAt},now);}
  /** Durable record of the hand this operation settled (multi-table), or the current hand's result (single table). */
  terminalResult(){
    if(this.#field)return this.#field.terminalResult();
    const s=this.publicSnapshot(),h=s.hand;
    return h?.result?{handId:h.handId,handNumber:s.handNumber,...h.result,tournament:s.tournament,participants:this.checkpoint().room.seats.map(([seat,p])=>({seatId:`seat-${seat}`,memberId:p.memberId}))}:null;
  }
  /** Readable record of a settled hand: the one this operation settled (multi-table) or the current one. */
  settledHistory(){
    if(this.#field)return this.#field.settledHistory();
    const c=this.#room.checkpoint(),h=this.#room.publicSnapshot();
    if(!c.hand||!h.hand?.result)return null;
    return {hand:c.hand,members:Object.fromEntries(c.seats.map(([n,p])=>[`seat-${n}`,p.memberId])),handNumber:h.handNumber};
  }
  #readNow() {
    const now=this.#clock();
    if(!Number.isSafeInteger(now)||now<0||now>Number.MAX_SAFE_INTEGER-this.#turnMs)throw new Error("Invalid server time");
    this.#lastNow=Math.max(this.#lastNow,now);return this.#lastNow;
  }
  #run<T>(operation:(now:number)=>T):T {
    const now=this.#readNow();this.#sample=now;
    try{return operation(now);}finally{this.#sample=null;}
  }
  /** A mutation: clears the multi-table "hand settled by this operation" marker first. */
  #op<T>(operation:(now:number)=>T):T {this.#field?.beginOperation();return this.#run(operation);}
  #transition<T>(operation:()=>T):T {
    const before=this.#room.publicSnapshot().hand,result=operation(),after=this.#room.publicSnapshot().hand;
    if(after?.handId!==this.#runout?.handId)this.#runout=undefined;
    const from=before?.handId===after?.handId?(before?.board.length??0):0;
    if(after?.result?.showdown&&(before?.handId!==after.handId||!before.result)&&from<5)this.#runout={handId:after.handId,fromBoardCount:from};
    return result;
  }
  #admit(now:number){if(this.#field){const at=this.#field.finishedAt;if(at!==null&&now>=at+600000)throw Error('Tournament table closed');return;}const s=this.#room.publicSnapshot();if(s.phase==='finished'&&s.completedAt!==null&&now>=s.completedAt+600000)throw Error('Tournament table closed');}
  #terms(now:number) {
    const terms=tournamentHandTerms({structure:this.#structure,starts_at:this.#startsAt},now);
    if(!terms)throw new Error("New hands are blocked before start or during break");
    return terms;
  }
  #project(state:RoomSnapshot,now:number) {
    const finished=state.phase==='finished',c=tournamentClock(this.#structure,this.#startsAt,finished?(state.completedAt??now):now);
    const occupied=state.seats.filter(s=>s.occupied),ready=occupied.length>=2&&occupied.every(s=>s.connected);
    return {...state,autoExitAt:finished&&state.completedAt!==null?state.completedAt+600000:null,runout:this.#runout&&this.#runout.handId===state.hand?.handId?{...this.#runout}:null,serverNow:now,startsAt:this.#startsAt,structure:structuredClone(this.#structure),clock:{...c,period:{...c.period},next:c.next?{...c.next}:null,following:this.#structure.periods[c.index+1]?{...this.#structure.periods[c.index+1]}:null},
      canStartHand:((state.phase==="waiting"&&ready)||state.phase==="complete")&&c.phase!=="scheduled"&&c.phase!=="break"};
  }
  /** One trusted decision per invocation, sharing the same server clock sample. */
  advance(control:TournamentControl) {return this.#op(now=>{
    if(typeof control?.enabled!=="boolean"||typeof control.published!=="boolean"||!Number.isSafeInteger(control.expectedCount)||control.expectedCount<2||control.expectedCount>FIELD_MAX_PLAYERS||!Array.isArray(control.members)||control.members.length>control.expectedCount)throw new Error("Invalid scheduler control");
    if(this.#field||control.expectedCount>=FIELD_MIN_PLAYERS)return this.#advanceField(control,now);
    if(control.seatedStart!==undefined&&typeof control.seatedStart!=="boolean")throw Error("Invalid seated start policy");
    const policyChanged=Boolean(control.seatedStart)&&!this.#seatedStart;if(control.seatedStart)this.#seatedStart=true;
    const readiness={...this.#room.registrationReadiness(control.members),expected:control.expectedCount};
    readiness.ready=readiness.ready&&control.members.length===control.expectedCount;
    const state=this.#project(this.#room.publicSnapshot(),now);
    const boundary=()=>{let end=Date.parse(this.#startsAt);if(now<end)return end;for(const p of this.#structure.periods){end+=p.minutes*60000;if(now<end)return end;}return null;};
    const result=(event:string,changed=false,nextWakeAt:number|null=null)=>({event,changed:changed||policyChanged,nextWakeAt,readiness,state:this.#project(this.#room.publicSnapshot(),now)});
    if(!control.enabled)return result("disabled");
    if(state.phase==="finished")return result("finished");
    if(state.phase==="playing"){
      if(state.turn&&now>=state.turn.expiresAt){const r=this.#transition(()=>this.#room.expireTurn(state.turn!));return result(r.expired?"timed-out":"time-bank",r.expired||Boolean((r as {banked?:boolean}).banked),this.#room.publicSnapshot().turn?.expiresAt??null);}
      return result("playing",false,state.turn?.expiresAt??null);
    }
    if(state.clock.phase==="scheduled")return result("scheduled",false,Date.parse(this.#startsAt));
    if(state.phase==="waiting"&&this.#seatedStart){
      if(!control.published)return result("waiting");if(state.clock.phase==="break")return result("break",false,boundary());
      if(!this.#room.seatedRegistrationReady(control.members))return result("insufficient-seated");
      this.#transition(()=>this.#room.startSeatedRegisteredHand(control.members,this.#terms(now)));return result("started",true,this.#room.publicSnapshot().turn?.expiresAt??null);
    }
    if(state.phase==="waiting"&&(!control.published||!readiness.ready))return result("waiting");
    if(state.clock.phase==="break")return result("break",false,boundary());
    if(state.phase==="waiting"){this.#transition(()=>this.#room.startRegisteredHand(control.members,this.#terms(now)));return result("started",true,this.#room.publicSnapshot().turn?.expiresAt??null);}
    const presentationPause=this.#runout?.handId===state.hand?.handId?runoutDuration(this.#runout!.fromBoardCount)+PAYOUT_ANIMATION_MS+1000:0;
    const due=(state.completedAt??now)+Math.max(this.#handPauseMs,presentationPause);
    if(!Number.isSafeInteger(due))throw new Error("Invalid next hand deadline");
    if(now<due)return result("pause",false,due);
    this.#transition(()=>this.#room.nextHand(state.hand!.handId,this.#terms(now)));return result("next-hand",true,this.#room.publicSnapshot().turn?.expiresAt??null);
  });}
  /** Multi-table: draw seats once the full roster is admitted, then one table decision per call. */
  #advanceField(control:TournamentControl,now:number){
    const view=()=>{const f=this.#field;if(!f)return this.#project(this.#room.publicSnapshot(),now);const t=f.featuredTable();return this.#projectField(t,f.room(t).publicSnapshot(),now,null);};
    const readiness=()=>{const f=this.#field;const seated=f?f.entrants.length:0;return {seated,connected:seated,ready:Boolean(f),expected:control.expectedCount};};
    const result=(event:string,changed=false,nextWakeAt:number|null=null)=>({event,changed,nextWakeAt,readiness:readiness(),state:view()});
    if(!control.enabled)return result("disabled");
    if(!this.#field){
      if(!control.published||control.members.length!==control.expectedCount)return result("waiting");
      if(this.#room.publicSnapshot().seats.some(x=>x.occupied))throw new Error("Single-table room already seated");
      this.#field=TournamentField.draw(control.members,this.#fieldOptions());return result("seated",true,now);
    }
    if(this.#field.finished)return result("finished");
    const start=Date.parse(this.#startsAt);
    if(now<start)return result("scheduled",false,start);
    const r=this.#field.advance(now,this.#fieldTerms(now),this.#handPauseMs);
    if(!r.changed&&this.#fieldTerms(now)===null){let end=start;for(const p of this.#structure.periods){end+=p.minutes*60000;if(now<end)break;}return result(r.event==='playing'?'break':r.event,false,r.nextWakeAt===null?end:Math.min(r.nextWakeAt,end));}
    return result(r.event,r.changed,r.nextWakeAt);
  }
  join(member:string,allowNewSeat:boolean){if(this.#field)return this.#op(now=>{this.#admit(now);const r=this.#field!.join(member);const watching='watching' in r;const t=r.table;return {connectionId:r.connectionId,state:this.#projectField(t,watching?this.#field!.room(t).publicSnapshot():r.state,now,member,watching)};});
   return this.#op(now=>{this.#admit(now);if(this.#seatedStart&&now<Date.parse(this.#startsAt)-600000)throw Error("Seating not open");const result=this.#room.join(member,allowNewSeat&&(!this.#seatedStart||now<Date.parse(this.#startsAt)));return {...result,state:this.#project(result.state,now)};});}
  disconnectConnection(connection:string){if(this.#field)return this.#op(()=>this.#field!.disconnectConnection(connection));return this.#op(()=>this.#room.disconnectConnection(connection));}
  publicSnapshot(){if(this.#field)return this.#run(now=>{const f=this.#field!,t=f.featuredTable();return this.#projectField(t,f.room(t).publicSnapshot(),now,null);});return this.#run(now=>this.#project(this.#room.publicSnapshot(),now));}
  snapshot(member:string,connection:string){
    if(this.#field)return this.#run(now=>{this.#admit(now);const f=this.#field!,at=f.locate(member,connection);const room=f.room(at.table);return this.#projectField(at.table,at.watching?room.publicSnapshot():room.snapshot(member,connection),now,member,at.watching);});
    return this.#run(now=>{this.#admit(now);return this.#project(this.#room.snapshot(member,connection),now);});}
  seat(member:string,seat:number){if(this.#field)throw new Error("Seats are drawn");return this.#op(now=>this.#project(this.#room.seat(member,seat),now));}
  connect(member:string){if(this.#field)return this.join(member,false);return this.#op(now=>{this.#admit(now);const r=this.#room.connect(member);return {...r,state:this.#project(r.state,now)};});}
  disconnect(member:string,connection:string){
    if(this.#field)return this.#op(now=>{const f=this.#field!;f.disconnect(member,connection);const t=f.tableOf(member)??f.featuredTable();return this.#projectField(t,f.room(t).publicSnapshot(),now,null);});
    return this.#op(now=>{this.#room.disconnect(member,connection);return this.#project(this.#room.publicSnapshot(),now);});}
  leave(member:string,connection:string){
    if(this.#field)return this.#op(now=>{const f=this.#field!,at=f.locate(member,connection);if(!at.watching&&!f.finished)throw new Error("Tournament survivor seat remains reserved");f.disconnect(member,connection);return this.#projectField(at.table,f.room(at.table).publicSnapshot(),now,null);});
    return this.#op(now=>this.#project(this.#room.leave(member,connection),now));}
  /** Trusted initial scheduler operation; no player-supplied blind terms. */
  startHand(buttonSeat:number){if(this.#field)throw new Error("Multi-table hands start from advance()");return this.#op(now=>{const terms=this.#terms(now);return this.#project(this.#transition(()=>this.#room.startHandWithTerms(buttonSeat,terms)),now);});}
  nextHand(previousHandId:string){if(this.#field)throw new Error("Multi-table hands start from advance()");return this.#op(now=>this.#project(this.#transition(()=>this.#room.nextHand(previousHandId,this.#terms(now))),now));}
  /** Existing hands and their turn deadlines continue through scheduled breaks. */
  act(member:string,connection:string,payload:unknown){
    if(this.#field)return this.#op(now=>{const r=this.#field!.act(member,connection,payload,now);return {replayed:r.replayed,acceptedRevision:r.acceptedRevision,state:this.#projectField(r.table,this.#field!.tableOf(member)===r.table?this.#field!.room(r.table).snapshot(member,connection):this.#field!.room(r.table).publicSnapshot(),now,member)};});
    return this.#op(now=>{const r=this.#transition(()=>this.#room.act(member,connection,payload));return {...r,state:this.#project(r.state,now)};});}
  timeBank(member:string,connection:string,handId:string,revision:number,requestId?:string){
    if(this.#field)return this.#op(now=>{const r=this.#field!.timeBank(member,connection,handId,revision,requestId);return {replayed:r.replayed,state:this.#projectField(r.table,r.state,now,member)};});
    return this.#op(now=>{const r=this.#room.timeBank(member,connection,handId,revision,requestId);return {...r,state:this.#project(r.state,now)};});}
  expireTurn(expected:TurnDeadline){
    if(this.#field)return this.#op(now=>{const f=this.#field!,r=f.expireTurn(expected,now),t=r.table??f.featuredTable();return {...r,state:this.#projectField(t,f.room(t).publicSnapshot(),now,null)};});
    return this.#op(now=>{const r=this.#transition(()=>this.#room.expireTurn(expected));return {...r,state:this.#project(r.state,now)};});}
}
