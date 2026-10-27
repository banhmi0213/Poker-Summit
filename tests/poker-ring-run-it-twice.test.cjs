const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),Module=require('module'),{randomUUID,randomBytes}=require('crypto');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
// The runner never reaches Supabase here; stub the client package so this runs without it.
const load=Module._load;Module._load=function(r,...a){if(r==='@supabase/supabase-js')return {createClient(){throw Error('no network in tests');}};return load.call(this,r,...a);};
const {RingHandOwner}=require('../lib/poker/ring-hand-owner.ts');
const {RingPlayRuntime,RUNS_CHOICE_MS,AUTO_BANK_AT_MS}=require('../lib/poker/ring-play-runtime.ts');
const keys={active:'k1',keys:{k1:randomBytes(32)}};
function world(){
 const table=randomUUID(),seats=[1,2].map(n=>({reservationId:randomUUID(),memberId:randomUUID(),seat:n,stack:1000})),hands={},writes=[];
 const context={tableId:table,capacity:2,terms:{sb:50,bb:100},seats,published:true,activeHandId:null,buttonSeat:1};
 let changedAt=Date.parse('2026-10-26T12:00:00Z'),now=changedAt;
 const store={timeout:false,from:0,
  async context(){return structuredClone(context);},
  async begin(r){hands[r.handId]={handId:r.handId,tableId:r.tableId,version:1,seats:r.roster,terms:{sb:r.terms.sb,bb:r.terms.bb},buttonSeat:r.terms.buttonSeat,sealed:r.sealed,status:r.result?'complete':'active',result:r.result};context.activeHandId=r.result?null:r.handId;return 1;},
  async write(r){const h=hands[r.handId];assert.equal(h.version,r.expected);h.version++;h.sealed=r.sealed;h.result=r.result;h.status=r.result?'complete':'active';if(r.result)context.activeHandId=null;writes.push({timeout:store.timeout,actor:store.actorReservation,from:store.from});changedAt=now;return h.version;},
  async load(id){return structuredClone(hands[id]??null);},
  async meta(){return {context:structuredClone(context),now:new Date(now).toISOString(),changedAt:new Date(changedAt).toISOString(),lastHandId:context.activeHandId,completedAt:null,runoutFrom:null,ready:[],penalties:{}};},
 };
 return {store,seats,table,writes,set now(v){now=v;},get now(){return now;},get changedAt(){return changedAt;}};
}
async function allIn(w){
 const owner=await (await RingHandOwner.prepare(w.store,w.table,keys)).commit();
 for(let i=0;i<4;i++){const s=owner.snapshot(null);if(!s.toAct)break;const seat=w.seats.find(p=>'seat-'+p.seat===s.toAct),me=owner.snapshot(seat.memberId);
  w.store.actorReservation=seat.reservationId;w.store.from=s.board.length;await owner.act(seat.memberId,{handId:s.handId,revision:s.revision,actionId:randomUUID(),action:me.legal.raise?{type:'raise',amount:me.legal.maxRaiseTo}:{type:'call'}});}
 return owner;
}
const runner=w=>new RingPlayRuntime({store:()=>w.store,keys});

test('ring all-in waits for answers, then the runner answers "once" after the choice window',async()=>{
 const w=world(),owner=await allIn(w),s=owner.snapshot(null);
 assert.equal(s.runs.decided,null);assert.ok(s.players.every(p=>p.hole));
 const before=w.writes.length,rt=runner(w);
 w.now=w.changedAt+RUNS_CHOICE_MS-1000;await rt['advance'](w.table,w.store);assert.equal(w.writes.length,before,'still waiting');
 w.now=w.changedAt+RUNS_CHOICE_MS+100;await rt['advance'](w.table,w.store);
 assert.equal(w.writes.length,before+1);assert.equal(w.writes.at(-1).timeout,false,'not a timeout strike');
 const done=(await RingHandOwner.restore(w.store,s.handId,keys)).snapshot(null);
 assert.ok(done.result.showdown);assert.equal(done.runs.decided,1);assert.equal(done.result.boards,undefined);
});

test('both players answering 2 settles twice without the runner',async()=>{
 const w=world(),owner=await allIn(w),s=owner.snapshot(null);
 for(const p of w.seats){const v=owner.snapshot(p.memberId);w.store.actorReservation=p.reservationId;await owner.act(p.memberId,{handId:v.handId,revision:v.revision,actionId:randomUUID(),action:{type:'runs',count:2}});}
 const done=owner.snapshot(null);assert.equal(done.result.boards.length,2);
 assert.equal(done.players.reduce((a,p)=>a+p.stack,0),2000);
});

test('ring free time bank is used automatically just before the turn runs out, once per hand',async()=>{
 const w=world(),owner=await (await RingHandOwner.prepare(w.store,w.table,keys)).commit(),s=owner.snapshot(null),banks=[];
 w.store.bank=async(member,reservation,hand,revision,request)=>{banks.push({member,reservation,hand,revision,request});};
 const rt=runner(w),actor=w.seats.find(p=>'seat-'+p.seat===s.toAct);
 w.now=w.changedAt+AUTO_BANK_AT_MS-500;await rt['advance'](w.table,w.store);assert.equal(banks.length,0,'not yet');
 w.now=w.changedAt+AUTO_BANK_AT_MS+100;await rt['advance'](w.table,w.store);
 assert.equal(banks.length,1);assert.equal(banks[0].reservation,actor.reservationId);assert.equal(banks[0].hand,s.handId);assert.equal(banks[0].revision,s.revision);
 const meta=w.store.meta;w.store.meta=async()=>({...(await meta()),bankUsed:{[actor.reservationId]:s.handId}});
 await rt['advance'](w.table,w.store);assert.equal(banks.length,1,'a used bank is not requested again');
});
