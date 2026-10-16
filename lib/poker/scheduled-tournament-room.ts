/** Trusted schedule wrapper around an in-process authoritative tournament room.
 * No network/authentication/persistence is installed here. All time is server-owned.
 */
import { SeatedHandRoom, type TurnDeadline } from "./seated-hand-room";
import { tournamentClock,validateStructure,type TournamentStructure } from "./tournament";
import { tournamentHandTerms } from "./tournament-hand";

type RoomSnapshot=ReturnType<SeatedHandRoom["publicSnapshot"]>;
export class ScheduledTournamentRoom {
  #room:SeatedHandRoom; #structure:TournamentStructure; #startsAt:string;
  #clock:()=>number; #lastNow=0; #sample:number|null=null; #turnMs:number;
  constructor(config:{structure:unknown;starts_at:string},options:{now?:()=>number;turnMs?:number}={}) {
    const normalized=validateStructure(config.structure),start=Date.parse(config.starts_at);
    if(typeof config.starts_at!=="string"||!Number.isSafeInteger(start)||start<0)throw new Error("Invalid tournament start");
    if(options.now!==undefined&&typeof options.now!=="function")throw new Error("Invalid server clock");
    // Explicit copy/allow-list: unknown configuration fields are not broadcast.
    this.#structure={startingStack:normalized.startingStack,anteType:normalized.anteType,lateRegLevel:normalized.lateRegLevel,reentry:normalized.reentry,
      periods:normalized.periods.map(p=>({kind:p.kind,minutes:p.minutes,sb:p.sb,bb:p.bb,ante:p.ante,note:p.note}))};
    this.#startsAt=new Date(start).toISOString();this.#clock=options.now??Date.now;this.#turnMs=options.turnMs??20000;
    const first=this.#structure.periods[0];
    this.#room=new SeatedHandRoom(this.#structure.startingStack,{level:1,index:0,sb:first.sb,bb:first.bb,ante:first.ante,anteType:this.#structure.anteType},
      {tournament:true,turnMs:this.#turnMs,now:()=>this.#sample??this.#readNow()});
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
