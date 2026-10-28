/** Trusted schedule wrapper around an in-process authoritative tournament room.
 * No network/authentication or automatic persistence is installed here. All time is server-owned.
 */
import { SeatedHandRoom, type TurnDeadline, type RoomCheckpoint } from "./seated-hand-room";
import { tournamentClock,validateStructure,type TournamentStructure } from "./tournament";
import {runoutDuration,PAYOUT_ANIMATION_MS} from './presentation-timing';
import { tournamentHandTerms } from "./tournament-hand";

type RoomSnapshot=ReturnType<SeatedHandRoom["publicSnapshot"]>;
export type TournamentControl={enabled:boolean;published:boolean;members:readonly string[];expectedCount:number;seatedStart?:boolean};
export type ScheduledCheckpoint={version:1;structure:TournamentStructure;startsAt:string;lastNow:number;room:RoomCheckpoint;handPauseMs?:number;seatedStart?:boolean;runout?:{handId:string;fromBoardCount:number}};
export class ScheduledTournamentRoom {
  #room:SeatedHandRoom; #structure:TournamentStructure; #startsAt:string;
  #clock:()=>number; #lastNow=0; #sample:number|null=null; #turnMs:number; #handPauseMs:number; #seatedStart=false;#runout:{handId:string;fromBoardCount:number}|undefined;
  constructor(config:{structure:unknown;starts_at:string},options:{now?:()=>number;turnMs?:number;handPauseMs?:number}={}) {
    const normalized=validateStructure(config.structure),start=Date.parse(config.starts_at);
    if(typeof config.starts_at!=="string"||!Number.isSafeInteger(start)||start<0)throw new Error("Invalid tournament start");
    if(options.now!==undefined&&typeof options.now!=="function")throw new Error("Invalid server clock");
    // Explicit copy/allow-list: unknown configuration fields are not broadcast.
    this.#structure={startingStack:normalized.startingStack,anteType:normalized.anteType,lateRegLevel:normalized.lateRegLevel,reentry:normalized.reentry,
      periods:normalized.periods.map(p=>({kind:p.kind,minutes:p.minutes,sb:p.sb,bb:p.bb,ante:p.ante,note:p.note}))};
    this.#startsAt=new Date(start).toISOString();this.#clock=options.now??Date.now;this.#turnMs=options.turnMs??20000;
    this.#handPauseMs=options.handPauseMs??8000;
    if(!Number.isSafeInteger(this.#handPauseMs)||this.#handPauseMs<0||this.#handPauseMs>60000)throw new Error("Invalid hand pause");
    const first=this.#structure.periods[0];
    this.#room=new SeatedHandRoom(this.#structure.startingStack,{level:1,index:0,sb:first.sb,bb:first.bb,ante:first.ante,anteType:this.#structure.anteType},
      {tournament:true,turnMs:this.#turnMs,now:()=>this.#sample??this.#readNow()});
  }
  /** Sensitive server-only checkpoint. No live connection tokens. */
  checkpoint():ScheduledCheckpoint {return structuredClone({version:1,structure:this.#structure,startsAt:this.#startsAt,lastNow:this.#lastNow,room:this.#room.checkpoint(),handPauseMs:this.#handPauseMs,...(this.#runout?{runout:this.#runout}:{}),...(this.#seatedStart?{seatedStart:true}:{})});}
  static restore(input:ScheduledCheckpoint,options:{now?:()=>number}={}) {
    const s=structuredClone(input);
    if(s?.version!==1||!Number.isSafeInteger(s.lastNow)||s.lastNow<0||!s.room?.tournament||s.room.startingStack!==s.structure?.startingStack)throw new Error("Invalid scheduled checkpoint");
    const room=new ScheduledTournamentRoom({structure:s.structure,starts_at:s.startsAt},{now:options.now,turnMs:s.room.turnMs,handPauseMs:s.handPauseMs===4000?8000:s.handPauseMs});
    if(s.seatedStart!==undefined&&typeof s.seatedStart!=="boolean")throw Error("Invalid seated start policy");room.#seatedStart=s.seatedStart??false;room.#lastNow=s.lastNow;room.#room=SeatedHandRoom.restore(s.room,()=>room.#sample??room.#readNow());if(s.runout){const h=room.#room.publicSnapshot().hand;if(!h?.result?.showdown||h.handId!==s.runout.handId||![0,3,4].includes(s.runout.fromBoardCount))throw Error('Invalid runout checkpoint');room.#runout=s.runout;}return room;
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
  #transition<T>(operation:()=>T):T {
    const before=this.#room.publicSnapshot().hand,result=operation(),after=this.#room.publicSnapshot().hand;
    if(after?.handId!==this.#runout?.handId)this.#runout=undefined;
    const from=before?.handId===after?.handId?(before?.board.length??0):0;
    if(after?.result?.showdown&&(before?.handId!==after.handId||!before.result)&&from<5)this.#runout={handId:after.handId,fromBoardCount:from};
    return result;
  }
  #admit(now:number){const s=this.#room.publicSnapshot();if(s.phase==='finished'&&s.completedAt!==null&&now>=s.completedAt+600000)throw Error('Tournament table closed');}
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
  advance(control:TournamentControl) {return this.#run(now=>{
    if(typeof control?.enabled!=="boolean"||typeof control.published!=="boolean"||!Number.isSafeInteger(control.expectedCount)||control.expectedCount<2||control.expectedCount>6||!Array.isArray(control.members)||control.members.length>control.expectedCount)throw new Error("Invalid scheduler control");
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
      if(state.turn&&now>=state.turn.expiresAt){const r=this.#transition(()=>this.#room.expireTurn(state.turn!));return result("timed-out",r.expired,this.#room.publicSnapshot().turn?.expiresAt??null);}
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
  join(member:string,allowNewSeat:boolean){return this.#run(now=>{this.#admit(now);if(this.#seatedStart&&now<Date.parse(this.#startsAt)-600000)throw Error("Seating not open");const result=this.#room.join(member,allowNewSeat&&(!this.#seatedStart||now<Date.parse(this.#startsAt)));return {...result,state:this.#project(result.state,now)};});}
  disconnectConnection(connection:string){return this.#run(()=>this.#room.disconnectConnection(connection));}
  publicSnapshot(){return this.#run(now=>this.#project(this.#room.publicSnapshot(),now));}
  snapshot(member:string,connection:string){return this.#run(now=>{this.#admit(now);return this.#project(this.#room.snapshot(member,connection),now);});}
  seat(member:string,seat:number){return this.#run(now=>this.#project(this.#room.seat(member,seat),now));}
  connect(member:string){return this.#run(now=>{this.#admit(now);const r=this.#room.connect(member);return {...r,state:this.#project(r.state,now)};});}
  disconnect(member:string,connection:string){return this.#run(now=>{this.#room.disconnect(member,connection);return this.#project(this.#room.publicSnapshot(),now);});}
  leave(member:string,connection:string){return this.#run(now=>this.#project(this.#room.leave(member,connection),now));}
  /** Trusted initial scheduler operation; no player-supplied blind terms. */
  startHand(buttonSeat:number){return this.#run(now=>{const terms=this.#terms(now);return this.#project(this.#transition(()=>this.#room.startHandWithTerms(buttonSeat,terms)),now);});}
  nextHand(previousHandId:string){return this.#run(now=>this.#project(this.#transition(()=>this.#room.nextHand(previousHandId,this.#terms(now))),now));}
  /** Existing hands and their turn deadlines continue through scheduled breaks. */
  act(member:string,connection:string,payload:unknown){return this.#run(now=>{const r=this.#transition(()=>this.#room.act(member,connection,payload));return {...r,state:this.#project(r.state,now)};});}
  timeBank(member:string,connection:string,handId:string,revision:number){return this.#run(now=>{const r=this.#room.timeBank(member,connection,handId,revision);return {...r,state:this.#project(r.state,now)};});}
  expireTurn(expected:TurnDeadline){return this.#run(now=>{const r=this.#transition(()=>this.#room.expireTurn(expected));return {...r,state:this.#project(r.state,now)};});}
}
