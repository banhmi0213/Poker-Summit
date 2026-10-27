// Disposable PostgreSQL: hand shares for the board are frozen, viewer-safe and anonymised.
const {PGlite}=require(process.env.POKER_PGLITE_MODULE||'@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const folder=path.resolve(__dirname,'../../supabase/migrations'),load=suffix=>fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(f=>f.endsWith(suffix))),'utf8');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema poker_private;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
 create function public.is_admin() returns boolean language sql as $$select false$$;
 create function public.is_suspended() returns boolean language sql as $$select false$$;
 create table public.poker_tournaments(id uuid primary key,title text);
 create table public.poker_ring_tables(id uuid primary key,title text);
 create table poker_private.tournament_rooms(room_id uuid primary key,tournament_id uuid);
 grant usage on schema public,auth to authenticated,anon,service_role;grant usage on schema poker_private to service_role;`);
 await db.exec(load('_poker_hand_histories.sql'));await db.exec(load('_poker_hand_stats.sql'));
 const share=load('_poker_hand_shares.sql');await db.exec(share);await db.exec(share);
 const ids=[1,2,3].map(i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`),table='30000000-0000-4000-8000-000000000001',hand='40000000-0000-4000-8000-000000000001';
 for(let i=0;i<3;i++)await db.query('insert into auth.users values($1,$2)',[ids[i],{display_name:'本名'+(i+1)}]);
 await db.query("insert into public.poker_ring_tables values($1,'卓')",[table]);
 const card=(rank,suit)=>({rank,suit});
 const record={version:1,handId:hand,terms:{sb:1,bb:2,ante:0,anteType:'none',level:0},buttonSeatId:'seat-1',board:[card(2,'c'),card(7,'d'),card(9,'h'),card(11,'s'),card(13,'c')],actions:[{street:'preflop',seatId:'seat-1',type:'call',amount:2,to:2,allIn:false,pot:5}],result:{showdown:true,winners:['seat-1'],payouts:{'seat-1':6}},
  players:[{seatId:'seat-1',seat:1,memberId:ids[0],position:'BTN',startStack:200,endStack:204,net:4,hole:[card(14,'s'),card(14,'h')],folded:false,shown:true},
           {seatId:'seat-3',seat:3,memberId:ids[1],position:'SB',startStack:200,endStack:199,net:-1,hole:[card(3,'s'),card(4,'h')],folded:true,shown:false},
           {seatId:'seat-5',seat:5,memberId:ids[2],position:'BB',startStack:200,endStack:197,net:-3,hole:[card(5,'s'),card(6,'h')],folded:false,shown:true}]};
 await db.exec('set role service_role');await db.query('select public.poker_hand_history_save($1,$2,$3,$4,$5)',[hand,'ring',table,1,record]);await db.exec('reset role');
 const as=async(uid,q,params)=>{await db.exec(`set test.uid='${uid}';set role authenticated`);try{return (await db.query(q,params)).rows[0].v;}finally{await db.exec('reset role');}};
 // P2 (folded, cards hidden from others) shares the hand.
 const sid=await as(ids[1],'select public.poker_hand_share($1) v',[hand]);
 assert.equal(await as(ids[1],'select public.poker_hand_share($1) v',[hand]),sid,'one share per member and hand');
 const outsider='00000000-0000-4000-8000-000000000009';
 await assert.rejects(as(outsider,'select public.poker_hand_share($1) v',[hand]),/Hand not available/,'only players of the hand can share it');
 const v=await as(outsider,'select public.poker_hand_share_view($1) v',[sid]);
 assert.deepEqual(v.players.map(p=>p.name),['プレイヤー1','投稿者','プレイヤー5'],'other players anonymised');
 assert.ok(!JSON.stringify(v).includes('本名'),'no real names');assert.ok(!JSON.stringify(v).includes(ids[0]),'no member ids');
 assert.deepEqual(v.players.map(p=>p.hole===null),[false,false,false],'P1 and P3 showed down, P2 is the poster');
 assert.equal(v.mine,false);assert.equal((await as(ids[1],'select public.poker_hand_share_view($1) v',[sid])).mine,true);
 // P1 shares: P2's folded cards stay hidden.
 const sid1=await as(ids[0],'select public.poker_hand_share($1) v',[hand]);
 const v1=await as(ids[2],'select public.poker_hand_share_view($1) v',[sid1]);
 assert.equal(v1.players.find(p=>p.seat===3).hole,null,'a folded hand nobody showed stays hidden');
 await assert.rejects(as('','select public.poker_hand_share_view($1) v',[sid]),/Login required/);
 await assert.rejects(as(ids[0],'select count(*) v from poker_private.hand_shares',[]),/permission denied/);
 console.log('poker hand share isolated test passed');
}finally{await db.close();}})().catch(error=>{console.error(error);process.exit(1);});
