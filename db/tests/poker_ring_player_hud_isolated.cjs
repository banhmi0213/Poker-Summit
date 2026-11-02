// Disposable PostgreSQL: ring player HUD — seat profiles, per-seat stats and private notes/colour labels.
const {PGlite}=require(process.env.POKER_PGLITE_MODULE||'@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const folder=path.resolve(__dirname,'../../supabase/migrations'),load=suffix=>fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(f=>f.endsWith(suffix))),'utf8');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema poker_private;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('is_anonymous',coalesce(current_setting('test.anon',true),'false')::boolean)$$;
 create function public.is_admin() returns boolean language sql as $$select false$$;
 create function public.is_suspended() returns boolean language sql as $$select coalesce(current_setting('test.suspended',true),'false')::boolean$$;
 create table public.profiles(user_id uuid primary key,display_name text,avatar_url text);
 create table public.poker_tournaments(id uuid primary key,title text);
 create table public.poker_ring_tables(id uuid primary key,title text,published boolean default true,deleted_at timestamptz);
 create table poker_private.tournament_rooms(room_id uuid primary key,tournament_id uuid);
 create table poker_private.ring_fund_reservations(id uuid primary key default gen_random_uuid(),table_id uuid,member_id uuid,seat_number integer,status text);
 grant usage on schema public,auth to authenticated,anon,service_role;grant usage on schema poker_private to service_role;`);
 await db.exec(load('_poker_hand_histories.sql'));await db.exec(load('_poker_hand_stats.sql'));
 const hud=load('_poker_ring_player_hud.sql');await db.exec(hud);await db.exec(hud); // re-runnable
 await db.exec(load('_poker_ring_hud_ats.sql'));await db.exec(load('_poker_ring_hud_ats.sql')); // ATS (2026/10/30), re-runnable
 const ids=[1,2,3].map(i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`),table='30000000-0000-4000-8000-000000000001',hidden='30000000-0000-4000-8000-000000000002';
 for(let i=0;i<3;i++){await db.query('insert into auth.users values($1,$2)',[ids[i],{display_name:'P'+(i+1)}]);await db.query('insert into public.profiles values($1,$2,null)',[ids[i],'P'+(i+1)]);}
 await db.query("insert into public.poker_ring_tables(id,title) values($1,'卓')",[table]);
 await db.query("insert into public.poker_ring_tables(id,title,published) values($1,'非公開',false)",[hidden]);
 for(let i=0;i<3;i++)await db.query("insert into poker_private.ring_fund_reservations(table_id,member_id,seat_number,status) values($1,$2,$3,'seated')",[table,ids[i],[1,3,5][i]]);
 await db.query("insert into poker_private.ring_fund_reservations(table_id,member_id,seat_number,status) values($1,$2,2,'seated')",[hidden,ids[0]]);
 // Two ring hands for P2 (seat 3): vpip both, pfr once, 3bet opp once (3bet), saw flop and showdown once (won).
 const card=(rank,suit)=>({rank,suit});let n=0;
 const hand=async(p2stats,kind='ring')=>{n++;const h=`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const record={version:1,handId:h,terms:{sb:1,bb:2,ante:0,anteType:'none',level:0},buttonSeatId:'seat-1',board:[],actions:[],result:{showdown:false,winners:['seat-1'],payouts:{'seat-1':4}},
   players:[{seatId:'seat-1',seat:1,memberId:ids[0],position:'BTN',startStack:100,endStack:102,net:2,hole:[card(14,'s'),card(14,'h')],folded:false,shown:false,stats:{vpip:true}},
            {seatId:'seat-3',seat:3,memberId:ids[1],position:'SB',startStack:100,endStack:98,net:-2,hole:[card(3,'s'),card(4,'h')],folded:true,shown:false,stats:p2stats}]};
  await db.exec('set role service_role');try{await db.query('select public.poker_hand_history_save($1,$2,$3,$4,$5)',[h,kind,table,n,record]);}finally{await db.exec('reset role');}};
 await hand({vpip:true,pfr:true,threeBetOpp:true,threeBet:true});
 await hand({vpip:true,sawFlop:true,wentToShowdown:true,wonAtShowdown:true,foldToCbetOpp:true,foldToCbet:false});
 await hand({vpip:false},'tournament'); // tournament hands never count
 const as=async(uid,q,params,extra='')=>{await db.exec(`set test.uid='${uid}';set test.anon='false';set test.suspended='false';${extra}set role authenticated`);try{return (await db.query(q,params)).rows[0].v;}finally{await db.exec('reset role');}};
 // Anonymous / suspended / logged-out viewers are refused.
 await assert.rejects(as(ids[0],'select public.poker_ring_member_hud($1,3) v',[table],"set test.anon='true';"),/Not authorized/);
 await assert.rejects(as(ids[0],'select public.poker_ring_member_hud($1,3) v',[table],"set test.suspended='true';"),/Not authorized/);
 await assert.rejects(as('','select public.poker_ring_member_profiles($1) v',[table]),/Not authorized/);
 // Direct table access is denied.
 await assert.rejects(as(ids[0],'select count(*) v from poker_private.member_notes',[]),/permission denied/);
 // Profiles mark the viewer's own seat.
 const profiles=await as(ids[0],'select public.poker_ring_member_profiles($1) v',[table]);
 assert.deepEqual(profiles.map(p=>[p.seat,p.displayName,p.you,p.color]),[[1,'P1',true,null],[3,'P2',false,null],[5,'P3',false,null]]);
 assert.ok(!JSON.stringify(profiles).includes(ids[1]),'member ids never leave the database');
 assert.deepEqual(await as(ids[0],'select public.poker_ring_member_profiles($1) v',[hidden]),[]);
 // Stats for seat 3 are ring-only counts with denominators.
 const p2=await as(ids[0],'select public.poker_ring_member_hud($1,3) v',[table]);
 assert.equal(p2.you,false);assert.equal(p2.note,'');assert.equal(p2.color,null);
 assert.deepEqual(p2.stats,{hands:2,vpip:2,pfr:1,threeBet:1,threeBetOpp:1,cbet:0,cbetOpp:0,foldTo3Bet:0,foldTo3BetOpp:0,foldToCbet:0,foldToCbetOpp:1,sawFlop:1,wtsd:1,wsd:1,steal:0,stealOpp:0});
 assert.ok(!JSON.stringify(p2).includes(ids[1]));
 assert.equal(await as(ids[0],'select public.poker_ring_member_hud($1,2) v',[table]),null); // empty seat
 assert.equal(await as(ids[0],'select public.poker_ring_member_hud($1,1) v',[hidden]),null); // unpublished table
 await assert.rejects(as(ids[0],'select public.poker_ring_member_hud($1,7) v',[table]),/Invalid seat/);
 const self=await as(ids[0],'select public.poker_ring_member_hud($1,1) v',[table]);assert.equal(self.you,true);assert.equal(self.note,null);
 // Notes and colours are private to the writer.
 await as(ids[0],"select public.poker_ring_member_note_set($1,3,$2,'red') v",[table,'  3ベット多め  ']);
 const mine=await as(ids[0],'select public.poker_ring_member_hud($1,3) v',[table]);assert.equal(mine.note,'3ベット多め');assert.equal(mine.color,'red');
 assert.equal((await as(ids[0],'select public.poker_ring_member_profiles($1) v',[table])).find(p=>p.seat===3).color,'red');
 const other=await as(ids[2],'select public.poker_ring_member_hud($1,3) v',[table]);assert.equal(other.note,'');assert.equal(other.color,null);
 assert.equal((await as(ids[2],'select public.poker_ring_member_profiles($1) v',[table])).find(p=>p.seat===3).color,null);
 await as(ids[0],"select public.poker_ring_member_note_set($1,3,'更新',null) v",[table]);
 const updated=await as(ids[0],'select public.poker_ring_member_hud($1,3) v',[table]);assert.equal(updated.note,'更新');assert.equal(updated.color,null);
 await assert.rejects(as(ids[0],"select public.poker_ring_member_note_set($1,3,'x','pink') v",[table]),/Invalid color/);
 await assert.rejects(as(ids[0],"select public.poker_ring_member_note_set($1,1,'x',null) v",[table]),/Cannot note yourself/);
 await assert.rejects(as(ids[0],"select public.poker_ring_member_note_set($1,2,'x',null) v",[table]),/Seat is empty/);
 const long=await as(ids[0],"select public.poker_ring_member_note_set($1,5,$2,'blue') v",[table,'あ'.repeat(800)]);assert.equal(long.note.length,500);
 // Clearing both removes the row.
 await as(ids[0],"select public.poker_ring_member_note_set($1,3,'',null) v",[table]);
 assert.equal(Number((await db.query('select count(*) n from poker_private.member_notes')).rows[0].n),1);
 console.log('poker ring player HUD isolated test passed');
}finally{await db.close();}})().catch(error=>{console.error(error);process.exit(1);});
