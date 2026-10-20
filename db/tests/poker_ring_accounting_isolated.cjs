// Actual PostgreSQL functions + real engine/encrypted coordinator. No external DB/network.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('crypto'),ts=require('typescript');
const runtime=process.env.POKER_PGLITE_MODULE||'@electric-sql/pglite';
const {PGlite}=require(runtime),{pgcrypto}=require(path.join(path.dirname(require.resolve(runtime+'/package.json')),'dist/contrib/pgcrypto.cjs'));
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
(async()=>{const db=new PGlite({extensions:{pgcrypto}});try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema extensions;create extension pgcrypto with schema extensions;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz,created_at timestamptz,updated_at timestamptz);
 create table public.member_status(user_id uuid primary key,suspended boolean default false);create table public.admin_users(user_id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.is_suspended() returns boolean language sql as $$select coalesce((select suspended from public.member_status where user_id=auth.uid()),false)$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 create table public.poker_ring_tables(id uuid primary key default gen_random_uuid(),title text,capacity integer,sb bigint,bb bigint,min_buy_in bigint,max_buy_in bigint,note text default '',published boolean default false,deleted_at timestamptz,revision integer default 1,sort_order integer default 0,created_at timestamptz default now(),updated_at timestamptz default now());`);
 const folder=path.resolve(__dirname,'../../supabase/migrations');for(const suffix of ['_poker_welcome_chips_and_escrow.sql','_poker_welcome_member_admin_eligibility.sql','_poker_reservation_member_guard.sql','_poker_ring_seating_and_hand_accounting.sql']){const file=fs.readdirSync(folder).find(f=>f.endsWith(suffix));await db.exec(fs.readFileSync(path.join(folder,file),'utf8'));}
 for(const file of ['poker-chip-ledger.sql','poker-ring-accounting.sql'])await db.exec(fs.readFileSync(path.resolve(__dirname,'../../tests/sql',file),'utf8'));
 const {SupabaseRingStore,RingHandOwner}=require('../../lib/poker/ring-hand-owner.ts');
 const names={poker_ring_context:['p_table'],poker_ring_hand_begin:['p_table','p_hand','p_roster','p_terms','p_sealed','p_result'],poker_ring_hand_write:['p_hand','p_expected','p_write','p_sealed','p_result'],poker_ring_hand_load:['p_hand'],poker_ring_reserve_funds:['p_member','p_table','p_amount','p_request'],poker_ring_seat_funds:['p_member','p_reservation','p_seat'],poker_ring_cashout:['p_member','p_reservation','p_request'],poker_ring_release_expired:['p_table']};
 let loseNextAck=false,writeRequests=[];
 const client={rpc:async(name,args)=>{try{assert.ok(names[name]);const values=names[name].map(k=>args[k]!==null&&typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);const r=await db.query(`select public.${name}(${names[name].map((k,i)=>k+' => $'+(i+1)).join(',')}) value`,values);if(name==='poker_ring_hand_write'){writeRequests.push(structuredClone(args));if(loseNextAck){loseNextAck=false;return {data:null,error:{code:'fixture_lost_ack'}};}}return {data:r.rows[0].value,error:null};}catch(error){if(process.env.POKER_E2E_DEBUG)console.error(name,error.message);return {data:null,error};}}};
 const store=new SupabaseRingStore(client),keys={active:'fixture',keys:{fixture:randomBytes(32)}},members=[randomUUID(),randomUUID()],tid=randomUUID(),reservations=[randomUUID(),randomUUID()];
 for(const m of members)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[m,'fixture-'+m+'@example.invalid']);
 await db.query('insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,published) values($1,$2,2,50,100,1000,3000,true)',[tid,'Isolated real ring']);
 await db.exec('set role service_role');for(let i=0;i<2;i++){await store.reserve(members[i],tid,1000,reservations[i]);await store.seat(members[i],reservations[i],i+1);}
 const prepared=await RingHandOwner.prepare(store,tid,keys);let owner=await prepared.commit();const repeated=await prepared.commit();assert.equal(owner.snapshot(null).handId,repeated.snapshot(null).handId);
 assert.equal(owner.snapshot(members[0]).players.filter(p=>p.hole!==null).length,1);assert.ok(!JSON.stringify(owner.snapshot(members[0])).includes(members[1]));assert.throws(()=>owner.snapshot(randomUUID()));
 let state=owner.snapshot(null),actor=members[Number(state.toAct.slice(5))-1],cmd={handId:state.handId,revision:state.revision,actionId:'lost-ack',action:{type:'call'}};
 const sameCards=owner.snapshot(actor).players.find(p=>p.hole)?.hole;loseNextAck=true;await assert.rejects(owner.act(actor,cmd));assert.ok(owner.uncertain);assert.throws(()=>owner.snapshot(actor));await assert.rejects(owner.act(actor,cmd));await owner.retryPending();assert.deepEqual(writeRequests[0],writeRequests[1]);assert.equal(owner.version,2);assert.deepEqual(owner.snapshot(actor).players.find(p=>p.hole)?.hole,sameCards);
 const beforeVersion=owner.version;await owner.act(actor,cmd);assert.equal(owner.version,beforeVersion);
 owner=await RingHandOwner.restore(store,prepared.handId,keys);let n=0;
 while(!owner.snapshot(null).result){state=owner.snapshot(null);const i=Number(state.toAct.slice(5))-1,viewer=owner.snapshot(members[i]),legal=viewer.legal;const action=legal.raise?{type:'raise',amount:legal.maxRaiseTo}:legal.call?{type:'call'}:{type:'check'};await owner.act(members[i],{handId:state.handId,revision:state.revision,actionId:'all-in-'+n++,action});assert.ok(n<20);}
 const final=owner.snapshot(null);assert.equal(final.players.reduce((sum,p)=>sum+p.stack,0),2000);assert.ok(final.result.showdown);owner=await RingHandOwner.restore(store,prepared.handId,keys);assert.deepEqual(owner.snapshot(null),final);
 for(let i=0;i<2;i++){const request=randomUUID();await store.cashout(members[i],reservations[i],request);await store.cashout(members[i],reservations[i],request);}
 await db.exec('reset role');const ac=(await db.query('select available,in_play from poker_private.ring_accounts where member_id=any($1::uuid[])',[members])).rows;assert.equal(ac.reduce((s,a)=>s+Number(a.available),0),6000);assert.ok(ac.every(a=>Number(a.in_play)===0));

 // Unequal 1k/2k/3k buy-ins at non-adjacent seats: engine side pots and accounting agree.
 const many=[randomUUID(),randomUUID(),randomUUID()],table6=randomUUID(),held=many.map(()=>randomUUID());
 for(const m of many)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[m,'three-'+m+'@example.invalid']);
 await db.query('insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,published) values($1,$2,6,50,100,1000,3000,true)',[table6,'Three unequal stacks']);
 await db.exec('set role service_role');for(let i=0;i<3;i++){await store.reserve(many[i],table6,1000*(i+1),held[i]);await store.seat(many[i],held[i],[1,3,6][i]);}
 const start3=await RingHandOwner.prepare(store,table6,keys);let third=await start3.commit(),turn=0;
 while(!third.snapshot(null).result){const pub=third.snapshot(null),index=[1,3,6].indexOf(Number(pub.toAct.slice(5))),view=third.snapshot(many[index]);const action=view.legal.raise?{type:'raise',amount:view.legal.maxRaiseTo}:view.legal.call?{type:'call'}:{type:'check'};await third.act(many[index],{handId:pub.handId,revision:pub.revision,actionId:'three-'+turn++,action});assert.ok(turn<25);}
 assert.equal(third.snapshot(null).players.reduce((s,p)=>s+p.stack,0),6000);
 for(let i=0;i<3;i++)await store.cashout(many[i],held[i],randomUUID());await db.exec('reset role');
 const totals=(await db.query('select sum(available)::bigint available,sum(in_play)::bigint in_play from poker_private.ring_accounts where member_id=any($1::uuid[])',[many])).rows[0];assert.equal(Number(totals.available),9000);assert.equal(Number(totals.in_play),0);
 console.log('PASS three unequal-stack all-ins at seats 1/3/6 and 9,000-chip final wallet conservation.');
 console.log('PASS ring SQL: welcome/replay/eligibility, seat ownership/capacity, atomic conserved settlement, duplicate/stale writes, final-stack/zero-stack cashout, expiry and ACL.');console.log('PASS actual engine + encrypted checkpoints + SQL: hidden hands, lost-ACK exact retry, durable restart, all-in showdown and wallet conservation (6,000 chip).');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
