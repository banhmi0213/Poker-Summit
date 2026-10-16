/** Backend owner boundary: no room mutation/read can escape an unresolved durable commit.
 * Transport must verify member identity and route a room to ONE owner. No socket/server is started.
 */
import {ScheduledTournamentRoom,type TournamentControl} from './scheduled-tournament-room';
import {prepareRoomSave,restoreRoom,type KeyRing,type RoomStore} from './room-persistence';
import type {TurnDeadline} from './seated-hand-room';

type Config=ConstructorParameters<typeof ScheduledTournamentRoom>[0];
type Options={roomId:string;store:RoomStore;keys:KeyRing;now?:()=>number;turnMs?:number;handPauseMs?:number;maxPending?:number;expectedConfig?:Config};
const unavailable=()=>new Error('Room unavailable; durable recovery required');
function checkConfig(room:ScheduledTournamentRoom,config?:Config){
 if(!config)return;
 const expected=new ScheduledTournamentRoom(config).checkpoint(),actual=room.checkpoint();
 if(expected.startsAt!==actual.startsAt||JSON.stringify(expected.structure)!==JSON.stringify(actual.structure))throw new Error('Stored room configuration mismatch');
}
export class DurableRoomOwner {
  #room:ScheduledTournamentRoom;
  #roomId:string; #store:RoomStore; #keys:KeyRing; #now?:()=>number;
  #expectedConfig?:Config;
  #version:number; #halted=true; #tail:Promise<void>=Promise.resolve(); #pending=0; #limit:number;
  private constructor(room:ScheduledTournamentRoom,version:number,options:Options) {
    const limit=options.maxPending??128;
    if(!Number.isSafeInteger(limit)||limit<1||limit>4096)throw new Error('Invalid owner queue limit');
    this.#expectedConfig=options.expectedConfig?structuredClone(options.expectedConfig):undefined;
    this.#room=room;this.#version=version;this.#roomId=options.roomId;this.#store=options.store;
    this.#keys=structuredClone(options.keys);this.#now=options.now;this.#limit=limit;
  }
  /** Create only a genuinely new room. Initial CAS commit must succeed before use. */
  static async create(config:Config,options:Options) {
    const owner=new DurableRoomOwner(new ScheduledTournamentRoom(config,{now:options.now,turnMs:options.turnMs,handPauseMs:options.handPauseMs}),0,options);
    await owner.#persist(owner.#room,0);owner.#halted=false;return owner;
  }
  /** No fallback to a fresh room when load/decryption fails or the room is missing.
   * Persist a disconnected recovery checkpoint before returning an owner to transport.
   */
  static async load(options:Options) {
    const saved=await restoreRoom(options.store,options.roomId,options.keys,{now:options.now});
    if(!saved)throw new Error('Stored room not found');
    checkConfig(saved.room,options.expectedConfig);
    const owner=new DurableRoomOwner(saved.room,saved.version,options);
    await owner.#persist(saved.room,saved.version);owner.#halted=false;return owner;
  }
  get health(){return {status:this.#halted?'halted' as const:'ready' as const,version:this.#version,pending:this.#pending};}
  #enqueue<T>(operation:()=>Promise<T>|T,recovery=false):Promise<T> {
    if(this.#pending>=this.#limit)return Promise.reject(new Error('Room queue is full'));
    this.#pending++;
    const task=this.#tail.then(()=>{if(this.#halted&&!recovery)throw unavailable();return operation();});
    // Failed commands must not poison the queue; halted state is checked for EACH queued item.
    this.#tail=task.then(()=>{},()=>{});
    return task.finally(()=>{this.#pending--;});
  }
  async #persist(room:ScheduledTournamentRoom,expected:number) {
    try {
      const prepared=prepareRoomSave(this.#roomId,expected,room,this.#keys);
      const version=await prepared.commit(this.#store);
      if(version!==expected+1)throw new Error('Invalid storage acknowledgement');
      this.#version=version;
    }catch{this.#halted=true;throw unavailable();}
  }
  #mutate<T>(operation:(room:ScheduledTournamentRoom)=>T,changed:(result:T)=>boolean=()=>true) {
    return this.#enqueue(async()=>{
      const before=this.#room.checkpoint().room;
      let result:T;
      try{result=operation(this.#room);}catch(error){
        // Known validation failures leave state unchanged. Unexpected partial changes fail closed.
        const after=this.#room.checkpoint().room;
        // A rejected command may still advance the monotonic clock floor.
        before.lastNow=after.lastNow;
        if(JSON.stringify(after)!==JSON.stringify(before)){this.#halted=true;throw unavailable();}
        throw error;
      }
      if(changed(result))await this.#persist(this.#room,this.#version);
      return result;
    });
  }
  /** Both public/private reads wait behind pending commits and reject while halted. */
  publicSnapshot(){return this.#enqueue(()=>this.#room.publicSnapshot());}
  snapshot(member:string,connection:string){return this.#enqueue(()=>this.#room.snapshot(member,connection));}
  seat(member:string,seat:number){return this.#mutate(r=>r.seat(member,seat));}
  connect(member:string){return this.#mutate(r=>r.connect(member));}
  disconnect(member:string,connection:string){return this.#mutate(r=>r.disconnect(member,connection));}
  leave(member:string,connection:string){return this.#mutate(r=>r.leave(member,connection));}
  startHand(buttonSeat:number){return this.#mutate(r=>r.startHand(buttonSeat));}
  nextHand(previousHandId:string){return this.#mutate(r=>r.nextHand(previousHandId));}
  act(member:string,connection:string,payload:unknown) {
    // Capture input NOW, not when earlier writes eventually complete.
    let captured:unknown;try{captured=structuredClone(payload);}catch{return Promise.reject(new Error('Invalid action payload'));}
    return this.#mutate(r=>r.act(member,connection,captured),r=>!r.replayed);
  }
  /** Scheduler only. Decision + readiness check + mutation share this owner's FIFO/commit. */
  advance(control:TournamentControl){const captured=structuredClone(control);return this.#mutate(r=>r.advance(captured),r=>r.changed);}
  expireTurn(deadline:TurnDeadline) {
    let captured:TurnDeadline;try{captured=structuredClone(deadline);}catch{return Promise.reject(new Error('Invalid deadline'));}
    return this.#mutate(r=>r.expireTurn(captured),r=>r.expired);
  }
  /** Recovery is serialized with queued work. No uncommitted in-memory state is reused.
   * Ambiguous save outcomes are resolved by reading storage, never by inventing a new deal.
   * Every old connection is invalid after success. Failure keeps ALL reads/writes halted.
   */
  recover(){return this.#enqueue(async()=>{
    this.#halted=true;
    try {
      const saved=await restoreRoom(this.#store,this.#roomId,this.#keys,{now:this.#now});
      if(!saved)throw unavailable();
      checkConfig(saved.room,this.#expectedConfig);
      await this.#persist(saved.room,saved.version);
      const state=saved.room.publicSnapshot();
      this.#room=saved.room;this.#halted=false;return state;
    }catch{this.#halted=true;throw unavailable();}
  },true);}
}
