// Disposable PostgreSQL: hand history write path, idempotency and per-viewer card privacy.
const {PGlite}=require(process.env.POKER_PGLITE_MODULE||'@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema poker_private;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false')::boolean$$;
 create function public.is_suspended() returns boolean language sql as $$select false$$;
 create table public.poker_tournaments(id uuid primary key,title text);
 create table public.poker_ring_tables(id uuid primary key,title text);
 create table poker_private.tournament_rooms(room_id uuid primary key,tournament_id uuid);
 grant usage on schema public,auth to authenticated,anon,service_role;grant usage on schema poker_private to service_role;`);
 const file=fs.readdirSync(path.resolve(__dirname,'../../supabase/migrations')).find(f=>f.endsWith('_poker_hand_histories.sql'));
 const sql=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations',file),'utf8');
 await db.exec(sql);await db.exec(sql); // re-runnable
 const ids=[1,2,3].map(i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`),table='30000000-0000-4000-8000-000000000001',hand='40000000-0000-4000-8000-000000000001';
 for(let i=0;i<ids.length;i++)await db.query('insert into auth.users values($1,$2)',[ids[i],{display_name:'P'+(i+1)}]);
 await db.query("insert into public.poker_ring_tables values($1,'テスト卓')",[table]);
 const card=(rank,suit)=>({rank,suit});
 const record={version:1,handId:hand,terms:{sb:50,bb:100,ante:0,anteType:'none',level:0},buttonSeatId:'seat-1',board:[card(2,'c'),card(7,'d'),card(9,'h'),card(11,'s'),card(13,'c')],actions:[{street:'preflop',seatId:'seat-1',type:'call',amount:100,to:100,allIn:false,pot:250}],result:{showdown:true,winners:['seat-1'],payouts:{'seat-1':300}},
  players:[{seatId:'seat-1',seat:1,memberId:ids[0],position:'BTN',startStack:1000,endStack:1200,net:200,hole:[card(14,'s'),card(14,'h')],folded:false,shown:true},
           {seatId:'seat-3',seat:3,memberId:ids[1],position:'SB',startStack:1000,endStack:950,net:-50,hole:[card(3,'s'),card(4,'h')],folded:true,shown:false},
           {seatId:'seat-5',seat:5,memberId:ids[2],position:'BB',startStack:1000,endStack:850,net:-150,hole:[card(5,'s'),card(6,'h')],folded:false,shown:true}]};
 const save=(r=record,h=hand)=>db.query('select public.poker_hand_history_save($1,$2,$3,$4,$5) ok',[h,'ring',table,null,r]);
 // Clients can neither write nor read the private tables or the save RPC.
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(save(),/permission denied/);await assert.rejects(db.query('select * from poker_private.hand_histories'),/permission denied/);await db.exec('reset role');}
 await db.exec('set role service_role');
 assert.equal((await save()).rows[0].ok,true);assert.equal((await save()).rows[0].ok,false); // idempotent
 await assert.rejects(save({...record,handId:'40000000-0000-4000-8000-000000000009'}),/Invalid hand history/);
 await assert.rejects(save({...record,players:record.players.map((p,i)=>i===1?{...p,memberId:ids[0]}:p)},'40000000-0000-4000-8000-000000000002'),/Invalid hand history/);
 await assert.rejects(save({...record,players:[record.players[0]]},'40000000-0000-4000-8000-000000000003'),/Invalid hand history/);
 assert.equal(Number((await db.query('select count(*) n from poker_private.hand_history_members')).rows[0].n),3);
 await db.exec('reset role');
 const as=async(uid,admin,q,params)=>{await db.exec(`set test.uid='${uid}';set test.admin='${admin}';set role authenticated`);try{return (await db.query(q,params)).rows[0].v;}finally{await db.exec('reset role');}};
 // Folded player (P2) sees own cards; P1 and P3 were shown; nobody sees P2's folded cards except P2 and operators.
 const p1=await as(ids[0],false,'select public.poker_hand_history_detail($1) v',[hand]);
 assert.equal(p1.title,'テスト卓');assert.deepEqual(p1.players.map(p=>p.name),['P1','P2','P3']);
 assert.deepEqual(p1.players.map(p=>p.hole===null),[false,true,false]);assert.deepEqual(p1.players.map(p=>p.you),[true,false,false]);
 assert.ok(!JSON.stringify(p1).includes(ids[1])&&!JSON.stringify(p1).includes(ids[2]),'members never receive other member IDs');
 const p2=await as(ids[1],false,'select public.poker_hand_history_detail($1) v',[hand]);assert.deepEqual(p2.players[1].hole,record.players[1].hole);
 const admin=await as(ids[2],true,'select public.poker_hand_history_detail($1,true) v',[hand]);assert.ok(admin.players.every(p=>Array.isArray(p.hole)&&p.memberId));
 await assert.rejects(as(ids[0],false,'select public.poker_hand_history_detail($1,true) v',[hand]),/Admin required/);
 const outsider='00000000-0000-4000-8000-000000000099';await db.query('insert into auth.users values($1,$2)',[outsider,{}]);
 assert.equal(await as(outsider,false,'select public.poker_hand_history_detail($1) v',[hand]),null);
 assert.deepEqual(await as(outsider,false,'select public.poker_hand_history_list() v'),[]);
 const list=await as(ids[0],false,'select public.poker_hand_history_list() v');assert.equal(list.length,1);assert.equal(list[0].handId,hand);
 assert.equal((await as(ids[0],true,'select public.poker_hand_history_list(true) v')).length,1);
 console.log('PASS hand history: service-only idempotent writes, roster validation, own/showdown-only cards for members, full cards for operators, list scoping.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exit(1);});
