// Release gate for public ring games (owner 2026/10/27): four players on one table with unequal stacks.
// Seating, a mid-hand leave (deferred to the end of the hand), a server restart / client reconnect mid-hand,
// all-ins with side pots, run-it-twice answers, and exact chip settlement against the engine's result.
const fs=require('fs'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('crypto'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
(async()=>{const db=await require('../../tests/helpers/poker-ring-database.cjs')();let runner;try{
const {RingPlayRuntime,SupabaseRingPlayStore,PlayingRingAdmissionStore}=require('../../lib/poker/ring-play-runtime.ts'),{SupabaseRingAdmissionStore}=require('../../lib/poker/ring-lobby-handler.ts');
const keys={active:'gate',keys:{gate:randomBytes(32)}},members=[randomUUID(),randomUUID(),randomUUID(),randomUUID()],table=randomUUID(),buyIns=[1000,1500,2500,3000];
for(const m of members)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[m,'gate-'+m+'@example.invalid']);
await db.query('insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,published) values($1,$2,6,50,100,1000,3000,true)',[table,'Release gate']);
await db.exec('set role service_role');
const names={poker_ring_play_write_v2:['p_hand','p_expected','p_write','p_sealed','p_result','p_timeout','p_from','p_actor'],poker_ring_choose_seat:['p_member','p_table','p_amount','p_request','p_seat'],poker_ring_timebank:['p_member','p_reservation','p_hand','p_revision','p_request'],poker_ring_lobby_state:['p_member','p_table'],poker_ring_admit:['p_member','p_table','p_amount','p_request'],poker_ring_depart:['p_member','p_reservation','p_request'],poker_ring_context:['p_table'],poker_ring_hand_load:['p_hand'],poker_ring_play_ready:['p_member','p_reservation'],poker_ring_play_ping:['p_member','p_table'],poker_ring_play_meta:['p_table'],poker_ring_play_tables:['p_limit'],poker_ring_play_begin:['p_table','p_hand','p_roster','p_terms','p_sealed','p_result'],poker_ring_play_write:['p_hand','p_expected','p_write','p_sealed','p_result','p_timeout','p_from'],poker_ring_cashout:['p_member','p_reservation','p_request']};
const client={rpc:async(name,args)=>{try{assert.ok(names[name],name);const values=names[name].map(k=>args[k]!==null&&typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);const r=await db.query(`select public.${name}(${names[name].map((k,i)=>k+' => $'+(i+1)).join(',')}) value`,values);return {data:r.rows[0].value,error:null};}catch(error){return {data:null,error};}}};
const base=new SupabaseRingAdmissionStore(client),factory=()=>new SupabaseRingPlayStore(client);
runner=new RingPlayRuntime({store:factory,keys});let service=new PlayingRingAdmissionStore(base,runner);
const wallets=async()=>{await db.exec('reset role');const r=(await db.query('select member_id,available,in_play from poker_private.ring_accounts where member_id=any($1::uuid[])',[members])).rows;await db.exec('set role service_role');return Object.fromEntries(r.map(x=>[x.member_id,{available:Number(x.available),inPlay:Number(x.in_play)}]));};
const total=w=>Object.values(w).reduce((s,x)=>s+x.available+x.inPlay,0);

// 1) Four players sit down with different buy-ins; the hand starts once everyone is ready.
const reservations=[];
for(let i=0;i<4;i++){const s=await base.change(members[i],{type:'join',tableId:table,amount:buyIns[i],requestId:randomUUID()});reservations.push(s.membership.reservationId);}
const before=await wallets(),startTotal=total(before);
for(const m of members)assert.equal(before[m].inPlay,buyIns[members.indexOf(m)],'buy-in moved to the table');
for(let i=0;i<4;i++)await service.change(members[i],{type:'ready',reservationId:reservations[i],requestId:randomUUID()});
let view=await service.state(members[0],table);assert.ok(view.play?.hand?.handId,'hand started with four players');
const handId=view.play.hand.handId;
assert.equal(view.play.hand.players.length,4);
const holes={};for(let i=0;i<4;i++){const v=await service.state(members[i],table);holes[i]=JSON.stringify(v.play.hand.players.find(p=>p.id===v.play.viewerSeat).hole);}

// 2) Player 4 leaves in the middle of the hand: the exit waits for the hand to finish.
await service.change(members[3],{type:'leave',reservationId:reservations[3],requestId:randomUUID()});
let s3=await service.state(members[3],table);assert.equal(s3.membership.exitRequested,true);assert.equal(s3.play.hand.handId,handId,'still in the current hand');

// 3) Server restart + client reconnect mid-hand: same hand, same cards, same turn.
const turn=view.play.hand.toAct,revision=view.play.hand.revision;
await runner.close();runner=new RingPlayRuntime({store:factory,keys});service=new PlayingRingAdmissionStore(base,runner);
for(let i=0;i<4;i++){const v=await service.state(members[i],table);assert.equal(v.play.hand.handId,handId);assert.equal(v.play.hand.toAct,turn);assert.equal(v.play.hand.revision,revision);assert.equal(JSON.stringify(v.play.hand.players.find(p=>p.id===v.play.viewerSeat).hole),holes[i],'own cards survive the reconnect');}

// 4) Everyone shoves or calls (unequal stacks make side pots); run-it-twice answers come from both sides.
const memberAt=async seat=>{for(let i=0;i<4;i++){const v=await service.state(members[i],table);if(v.play.viewerSeat===seat)return i;}return -1;};
let result=null;
for(let step=0;step<40;step++){
 const pub=await service.state(members[0],table),h=pub.play.hand;
 if(h.handId!==handId||h.result){result=h.handId===handId?h.result:'next-hand';break;}
 if(h.runs&&h.runs.decided===null){
  for(let i=0;i<4;i++){const v=await service.state(members[i],table);if(v.play.hand.runs?.canChoose)await service.change(members[i],{type:'act',reservationId:reservations[i],requestId:randomUUID(),command:{handId,revision:v.play.hand.revision,actionId:'runs-'+i,action:{type:'runs',count:i%2?2:1}}});}
  continue;
 }
 if(!h.toAct){await runner.tick(table);continue;}
 const i=await memberAt(h.toAct),v=await service.state(members[i],table),legal=v.play.hand.legal;assert.ok(legal,'actor has legal actions');
 const action=legal.raise&&step<3?{type:v.play.hand.players.some(p=>p.committed>0)?'raise':'bet',amount:legal.maxRaiseTo}:legal.call?{type:'call'}:{type:'check'};
 await service.change(members[i],{type:'act',reservationId:reservations[i],requestId:randomUUID(),command:{handId,revision:v.play.hand.revision,actionId:'gate-'+step,action}});
}
const saved=await factory().load(handId);assert.ok(saved&&saved.status==='complete','hand settled');
const finalStacks=Object.fromEntries(saved.result.map(r=>[r.reservationId,r.stack]));
const handRake=saved.result.reduce((s,r)=>s+(r.rake??0),0);assert.ok(handRake>=0&&handRake<=300,'rake at most 3 BB');
assert.equal(Object.values(finalStacks).reduce((s,x)=>s+x,0)+handRake,buyIns.reduce((s,x)=>s+x,0),'chips on the table plus the house rake conserved through the side pots');

// 5) Settlement: the leaver is paid out at the end of the hand; everyone's wallet matches the engine's final stacks.
for(let k=0;k<6;k++){await runner.tick(table);await new Promise(r=>setTimeout(r,200));}
const after=await wallets();assert.equal(total(after)+handRake,startTotal,'wallet totals plus the house rake conserved');
await db.exec('reset role');assert.equal(Number((await db.query('select coalesce(sum(amount),0)::bigint t from poker_private.ring_rake where member_id=any($1::uuid[])',[members])).rows[0].t),handRake,'the rake is in the house ledger');await db.exec('set role service_role');
const leaver=await service.state(members[3],table);assert.equal(leaver.membership,null,'the leaver is out after the hand');
assert.equal(after[members[3]].inPlay,0);assert.equal(after[members[3]].available,before[members[3]].available+finalStacks[reservations[3]],'leaver gets exactly the final stack');
for(let i=0;i<3;i++){const w=after[members[i]];assert.equal(w.available+w.inPlay,before[members[i]].available+finalStacks[reservations[i]],'seated player keeps exactly the final stack');}
console.log(`PASS release gate: 4 players, unequal stacks ${buyIns.join('/')}, mid-hand leave paid ${finalStacks[reservations[3]]}, restart/reconnect kept cards and turn, side pots and wallets conserved (${startTotal}).`);
}catch(error){console.error(error);process.exitCode=1;}finally{await runner?.close();await db.close?.();}})();
