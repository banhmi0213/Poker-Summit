/** Trusted schedule wrapper around an in-process authoritative tournament room.
 * No network/authentication or automatic persistence is installed here. All time is server-owned.
 */
import { SeatedHandRoom, type TurnDeadline, type RoomCheckpoint } from "./seated-hand-room";
import { tournamentClock,validateStructure,type TournamentStructure } from "./tournament";
import { tournamentHandTerms } from "./tournament-hand";

type RoomSnapshot=ReturnType<SeatedHandRoom["publicSnapshot"]>;
export type TournamentControl={enabled:boolean;published:boolean;members:readonly string[];expectedCount:number};
export type ScheduledCheckpoint={version:1;structure:TournamentStructure;startsAt:string;lastNow:number;room:RoomCheckpoint;handPauseMs?:number};
export class ScheduledTournamentRoom {
  #room:SeatedHandRoom; #structure:TournamentStructure; #startsAt:string;
  #clock:()=>number; #lastNow=0; #sample:number|null=null; #turnMs:number; #handPauseMs:number;
  constructor(config:{structure:unknown;starts_at:string},options:{now?:()=>number;turnMs?:number;handPauseMs?:number}={}) {
    const normalized=validateStructure(config.structure),start=Date.parse(config.starts_at);
    if(typeof config.starts_at!=="string"||!Number.isSafeInteger(start)||start<0)throw new Error("Invalid tournament start");
    if(options.now!==undefined&&typeof options.now!=="function")throw new Error("Invalid server clock");
    // Explicit copy/allow-list: unknown configuration fields are not broadcast.
    this.#structure={startingStack:normalized.startingStack,anteType:normalized.anteType,lateRegLevel:normalized.lateRegLevel,reentry:normalized.reentry,
      periods:normalized.periods.map(p=>({kind:p.kind,minutes:p.minutes,sb:p.sb,bb:p.bb,ante:p.ante,note:p.note}))};
    this.#startsAt=new Date(start).toISOString();this.#clock=options.now??Date.now;this.#turnMs=options.turnMs??20000;
    this.#handPauseMs=options.handPauseMs??4000;
    if(!Number.isSafeInteger(this.#handPauseMs)||this.#handPauseMs<0||this.#handPauseMs>60000)throw new Error("Invalid hand pause");
    const first=this.#structure.periods[0];
    this.#room=new SeatedHandRoom(this.#structure.startingStack,{level:1,index:0,sb:first.sb,bb:first.bb,ante:first.ante,anteType:this.#structure.anteType},
      {tournament:true,turnMs:this.#turnMs,now:()=>this.#sample??this.#readNow()});
  }
  /** Sensitive server-only checkpoint. No live connection tokens. */
  checkpoint():ScheduledCheckpoint {return structuredClone({version:1,structure:this.#structure,startsAt:this.#startsAt,lastNow:this.#lastNow,room:this.#room.checkpoint(),handPauseMs:this.#handPauseMs});}
  static restore(input:ScheduledCheckpoint,options:{now?:()=>number}={}) {
    const s=structuredClone(input);
    if(s?.version!==1||!Number.isSafeInteger(s.lastNow)||s.lastNow<0||!s.room?.tournament||s.room.startingStack!==s.structure?.startingStack)throw new Error("Invalid scheduled checkpoint");
    const room=new ScheduledTournamentRoom({structure:s.structure,starts_at:s.startsAt},{now:options.now,turnMs:s.room.turnMs,handPauseMs:s.handPauseMs});
    room.#lastNow=s.lastNow;room.#room=SeatedHandRoom.restore(s.room,()=>room.#sample??room.#readNow());return room;
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
  #terms(now:number) {
    const terms=tournamentHandTerms({structure:this.#structure,starts_at:this.#startsAt},now);
    if(!terms)throw new Error("New hands are blocked before start or during break");
    return terms;
  }
  #project(state:RoomSnapshot,now:number) {
    const c=tournamentClock(this.#structure,this.#startsAt,now);
    const occupied=state.seats.filter(s=>s.occupied),ready=occupied.length>=2&&occupied.every(s=>s.connected);
    return {...state,serverNow:now,clock:{...c,period:{...c.period},next:c.next?{...c.next}:null,following:this.#structure.periods[c.index+1]?{...this.#structure.periods[c.index+1]}:null},
      canStartHand:((state.phase==="waiting"&&ready)||state.phase==="complete")&&c.phase!=="scheduled"&&c.phase!=="break"};
  }
  /** One trusted decision per invocation, sharing the same server clock sample. */
  advance(control:TournamentControl) {return this.#run(now=>{
    if(typeof control?.enabled!=="boolean"||typeof control.published!=="boolean"||!Number.isSafeInteger(control.expectedCount)||control.expectedCount<2||control.expectedCount>6||!Array.isArray(control.members)||control.members.length>control.expectedCount)throw new Error("Invalid scheduler control");
    const readiness={...this.#room.registrationReadiness(control.members),expected:control.expectedCount};
    readiness.ready=readiness.ready&&control.members.length===control.expectedCount;
    const state=this.#project(this.#room.publicSnapshot(),now);
    const boundary=()=>{let end=Date.parse(this.#startsAt);if(now<end)return end;for(const p of this.#structure.periods){end+=p.minutes*60000;if(now<end)return end;}return null;};
    const result=(event:string,changed=false,nextWakeAt:number|null=null)=>({event,changed,nextWakeAt,readiness,state:this.#project(this.#room.publicSnapshot(),now)});
    if(!control.enabled)return result("disabled");
    if(state.phase==="finished")return result("finished");
    if(state.phase==="playing"){
      if(state.turn&&now>=state.turn.expiresAt){const r=this.#room.expireTurn(state.turn);return result("timed-out",r.expired,this.#room.publicSnapshot().turn?.expiresAt??null);}
      return result("playing",false,state.turn?.expiresAt??null);
    }
    if(state.clock.phase==="scheduled")return result("scheduled",false,Date.parse(this.#startsAt));
    if(state.phase==="waiting"&&(!control.published||!readiness.ready))return result("waiting");
    if(state.clock.phase==="break")return result("break",false,boundary());
    if(state.phase==="waiting"){this.#room.startRegisteredHand(control.members,this.#terms(now));return result("started",true,this.#room.publicSnapshot().turn?.expiresAt??null);}
    const due=(state.completedAt??now)+this.#handPauseMs;
    if(!Number.isSafeInteger(due))throw new Error("Invalid next hand deadline");
    if(now<due)return result("pause",false,due);
    this.#room.nextHand(state.hand!.handId,this.#terms(now));return result("next-hand",true,this.#room.publicSnapshot().turn?.expiresAt??null);
  });}
  publicSnapshot(){return this.#run(now=>this.#project(this.#room.publicSnapshot(),now));}
  snapshot(member:string,connection:string){return this.#run(now=>this.#project(this.#room.snapshot(member,connection),now));}
  seat(member:string,seat:number){return this.#run(now=>this.#project(this.#room.seat(member,seat),now));}
  connect(member:string){return this.#run(now=>{const r=this.#room.connect(member);return {...r,state:this.#project(r.state,now)};});}
  disconnect(member:string,connection:string){return this.#run(now=>{this.#room.disconnect(member,connection);return this.#project(this.#room.publicSnapshot(),now);});}
  leave(member:string,connection:string){return this.#run(now=>this.#project(this.#room.leave(member,connection),now));}
  /** Trusted initial scheduler operation; no player-supplied blind terms. */
  startHand(buttonSeat:number){return this.#run(now=>{const terms=this.#terms(now);return this.#project(this.#room.startHandWithTerms(buttonSeat,terms),now);});}
  nextHand(previousHandId:string){return this.#run(now=>this.#project(this.#room.nextHand(previousHandId,this.#terms(now)),now));}
  /** Existing hands and their turn deadlines continue through scheduled breaks. */
  act(member:string,connection:string,payload:unknown){return this.#run(now=>{const r=this.#room.act(member,connection,payload);return {...r,state:this.#project(r.state,now)};});}
  expireTurn(expected:TurnDeadline){return this.#run(now=>{const r=this.#room.expireTurn(expected);return {...r,state:this.#project(r.state,now)};});}
}
