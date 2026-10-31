// Per-table ring rake (owner 2026/10/31): each table has one of 3%・3BB／5%・5BB／10%・10BB; the hand records it and the
// database checks the cap of that hand's own table. Real PostgreSQL functions + the real engine/coordinator.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('crypto'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
(async()=>{const db=await require('../../tests/helpers/poker-ring-database.cjs')();try{
 for(const file of ['poker-chip-ledger.sql','poker-ring-accounting.sql','poker-ring-admission.sql','poker-ring-exits.sql','poker-ring-live.sql'])await db.exec(fs.readFileSync(path.resolve(__dirname,'../../tests/sql',file),'utf8'));
 // Minimal stand-ins for the objects the migration also replaces (hand history view, admin check).
 await db.exec(`create table if not exists poker_private.hand_histories(hand_id uuid primary key,kind text,source_id uuid,hand_number integer,played_at timestamptz default now(),record jsonb);
  create or replace function poker_private.hand_history_title(p_kind text,p_source uuid) returns text language sql as $$select null::text$$;
  create or replace function public.is_admin() returns boolean language sql as $$select exists(select 1 from public.admin_users where user_id=auth.uid())$$;`);
 const folder=path.resolve(__dirname,'../../supabase/migrations');
 await db.exec(fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(f=>f.endsWith('_poker_table_rake.sql'))),'utf8'));
 await assert.rejects(db.query("insert into public.poker_ring_tables(title,capacity,sb,bb,min_buy_in,max_buy_in,rake_bps,rake_cap_bb) values('bad',2,50,100,1000,3000,1000,5)"),'only charted rake levels');
 const {SupabaseRingStore,RingHandOwner}=require('../../lib/poker/ring-hand-owner.ts');
 const names={poker_ring_context:['p_table'],poker_ring_hand_begin:['p_table','p_hand','p_roster','p_terms','p_sealed','p_result'],poker_ring_hand_write:['p_hand','p_expected','p_write','p_sealed','p_result'],poker_ring_hand_load:['p_hand'],poker_ring_reserve_funds:['p_member','p_table','p_amount','p_request'],poker_ring_seat_funds:['p_member','p_reservation','p_seat']};
 const client={rpc:async(name,args)=>{try{assert.ok(names[name]);const values=names[name].map(k=>args[k]!==null&&typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);const r=await db.query(`select public.${name}(${names[name].map((k,i)=>k+' => $'+(i+1)).join(',')}) value`,values);return {data:r.rows[0].value,error:null};}catch(e){return {data:null,error:e};}}};
 const store=new SupabaseRingStore(client),keys={active:'fixture',keys:{fixture:randomBytes(32)}};
 async function playAllIn(bps,cap){
  const members=[randomUUID(),randomUUID()],tid=randomUUID(),reservations=[randomUUID(),randomUUID()];
  for(const m of members)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[m,'rake-'+m+'@example.invalid']);
  await db.query('insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,published,rake_bps,rake_cap_bb) values($1,$2,2,50,100,1000,3000,true,$3,$4)',[tid,'rake '+bps,bps,cap]);
  await db.query('update poker_private.ring_accounts set available=5000 where member_id=any($1::uuid[])',[members]).catch(()=>{});
  await db.exec('set role service_role');
  try{
   for(let i=0;i<2;i++){await store.reserve(members[i],tid,3000,reservations[i]);await store.seat(members[i],reservations[i],i+1);}
   const ctx=await store.context(tid);assert.equal(ctx.terms.rakeBps,bps);assert.equal(ctx.terms.rakeCapBb,cap);
   const prepared=await RingHandOwner.prepare(store,tid,keys);const owner=await prepared.commit();let n=0;
   while(!owner.snapshot(null).result){const state=owner.snapshot(null);if(state.runs&&state.toAct===null){const seat=state.runs.participants.find(id=>state.runs.choices[id]===null);await owner.act(members[Number(seat.slice(5))-1],{handId:state.handId,revision:state.revision,actionId:'runs-'+n++,action:{type:'runs',count:1}});continue;}
    const i=Number(state.toAct.slice(5))-1,legal=owner.snapshot(members[i]).legal;const action=legal.raise?{type:'raise',amount:legal.maxRaiseTo}:legal.call?{type:'call'}:{type:'check'};
    await owner.act(members[i],{handId:state.handId,revision:state.revision,actionId:'all-in-'+n++,action});assert.ok(n<20);}
   const r=owner.snapshot(null).result;await db.exec('reset role');
   const terms=(await db.query('select terms from poker_private.ring_hands where id=$1',[prepared.handId])).rows[0].terms;
   assert.equal(terms.rakeBps,bps);assert.equal(terms.rakeCapBb,cap);
   const house=Number((await db.query('select coalesce(sum(amount),0)::bigint t from poker_private.ring_rake where table_id=$1',[tid])).rows[0].t);
   return {rake:r.rake??0,house};
  }finally{await db.exec('reset role');}
 }
 // Both all-in for 3,000 each: the contested pot is 6,000.
 const low=await playAllIn(300,3);assert.equal(low.rake,180,'3% of 6,000 = 180 (cap 300)');assert.equal(low.house,180);
 const mid=await playAllIn(500,5);assert.equal(mid.rake,300,'5% of 6,000 = 300 (cap 500)');assert.equal(mid.house,300);
 const high=await playAllIn(1000,10);assert.equal(high.rake,600,'10% of 6,000 = 600 (cap 1,000), above the old 3 BB limit');assert.equal(high.house,600);
 console.log('PASS per-table rake: each table charges its own rule, the hand records it, the database checks that cap.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exit(1);});
