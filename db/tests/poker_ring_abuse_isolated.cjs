// Anti-abuse (owner 2026/10/27): confirmed e-mail only, seat-join and refill throttles, poker bans, player reports.
const assert=require('node:assert/strict'),{randomUUID}=require('crypto'),fs=require('fs'),path=require('path');
const folder=path.resolve(__dirname,'../../supabase/migrations'),load=s=>fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(f=>f.endsWith(s))),'utf8');
(async()=>{const db=await require('../../tests/helpers/poker-ring-database.cjs')();try{
 await db.exec(`create or replace function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
  create or replace function public.is_admin() returns boolean language sql as $$select exists(select 1 from public.admin_users where user_id=auth.uid())$$;
  create table if not exists public.profiles(user_id uuid primary key,display_name text,avatar_url text);`);
 const hud=load('_poker_ring_player_hud.sql'),abuse=load('_poker_abuse_controls.sql');
 await db.exec(hud);await db.exec(abuse);await db.exec(abuse); // re-runnable
 const [a,b,c,admin,unconfirmed]=[0,1,2,3,4].map(()=>randomUUID()),t=randomUUID();
 for(const m of [a,b,c,admin])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[m,m+'@example.invalid']);
 await db.query('insert into auth.users(id,email) values($1,$2)',[unconfirmed,unconfirmed+'@example.invalid']);
 await db.query('insert into public.admin_users values($1)',[admin]);
 for(const [m,n] of [[a,'A'],[b,'B'],[c,'C']])await db.query('insert into public.profiles values($1,$2,null)',[m,n]);
 await db.query('insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,published) values($1,$2,6,1,2,80,200,true)',[t,'1/2']);
 const svc=async(sql,args=[])=>{await db.exec('set role service_role');try{return (await db.query(sql,args)).rows[0];}finally{await db.exec('reset role');}};
 const as=async(m,sql,args=[])=>{await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${m}',false)`);try{return (await db.query(sql,args)).rows[0];}finally{await db.exec('reset role');}};
 const admit=m=>svc('select public.poker_ring_admit($1,$2,100,$3) v',[m,t,randomUUID()]);
 // Unconfirmed e-mail cannot take a seat.
 await assert.rejects(admit(unconfirmed),/./,'unconfirmed e-mail is refused');
 // Seat-join throttle: 30 joins an hour.
 const reservation=async m=>(await db.query("select id from poker_private.ring_fund_reservations where member_id=$1 and status in('held','seated') order by created_at desc limit 1",[m])).rows[0]?.id;
 for(let i=0;i<30;i++){await admit(c);const r=await reservation(c);if(r)await svc('select public.poker_ring_depart($1,$2,$3) v',[c,r,randomUUID()]);}
 await assert.rejects(admit(c),/Too many seat changes/,'31st join in an hour is refused');
 // Refill throttle: 3 a day.
 for(let i=0;i<3;i++){await db.query('update poker_private.ring_accounts set available=0,in_play=0 where member_id=$1',[b]);await as(b,'select public.poker_ring_refill($1) v',[randomUUID()]);}
 await db.query('update poker_private.ring_accounts set available=0,in_play=0 where member_id=$1',[b]);
 await assert.rejects(as(b,'select public.poker_ring_refill($1) v',[randomUUID()]),/Refill limit reached/);
 // Reports: A reports B by seat; duplicates within a day are ignored; self and empty seats are refused.
 await db.query('update poker_private.ring_accounts set available=3000 where member_id=$1',[b]);
 await admit(a);await admit(b);
 const seats=(await db.query("select member_id,seat_number from poker_private.ring_fund_reservations where table_id=$1 and status='seated'",[t])).rows;
 if(seats.length<2){ // admission may only hold the funds; seat them for the report path
  let n=1;for(const m of [a,b])await db.query("update poker_private.ring_fund_reservations set status='seated',seat_number=$2,table_stack=amount where member_id=$1 and status='held'",[m,n++]);
 }
 const seatOf=async m=>(await db.query("select seat_number from poker_private.ring_fund_reservations where member_id=$1 and table_id=$2 and status='seated'",[m,t])).rows[0].seat_number;
 const sa=await seatOf(a),sb=await seatOf(b);
 assert.equal((await as(a,'select public.poker_ring_member_report($1,$2,$3,$4) v',[t,sb,'abuse','  チャットで暴言  '])).v.duplicate,false);
 assert.equal((await as(a,'select public.poker_ring_member_report($1,$2,$3,$4) v',[t,sb,'griefing',''])).v.duplicate,true);
 await assert.rejects(as(a,'select public.poker_ring_member_report($1,$2,$3,$4) v',[t,sa,'abuse','']),/Cannot report yourself/);
 await assert.rejects(as(a,'select public.poker_ring_member_report($1,$2,$3,$4) v',[t,6,'abuse','']),/Seat is empty/);
 await assert.rejects(as(a,'select public.poker_ring_member_report($1,$2,$3,$4) v',[t,sb,'spam','']),/Invalid reason/);
 await assert.rejects(as(a,'select count(*) v from poker_private.member_reports'),/permission denied/);
 // Operators see the report and can ban; a banned member cannot take a seat; lifting restores.
 await assert.rejects(as(a,'select public.poker_admin_reports() v'),/Admin required/);
 const list=(await as(admin,'select public.poker_admin_reports() v')).v;
 assert.equal(list.length,1);assert.equal(list[0].memberId,b);assert.equal(list[0].name,'B');assert.equal(list[0].open,1);assert.deepEqual(list[0].reasons,{abuse:1});assert.equal(list[0].notes[0].note,'チャットで暴言');
 await as(admin,'select public.poker_admin_ban($1,7,$2) v',[b,'暴言']);
 assert.equal((await as(admin,'select public.poker_admin_reports() v')).v[0].open,0);
 await db.query("update poker_private.ring_fund_reservations set status='returned',returned_at=now(),seat_number=null where member_id=$1 and status in('held','seated')",[b]).catch(()=>{});
 assert.equal((await db.query('select poker_private.ring_member_eligible($1) v',[b])).rows[0].v,false,'banned');
 await as(admin,'select public.poker_admin_ban($1,null,null) v',[b]);
 assert.equal((await db.query('select poker_private.ring_member_eligible($1) v',[b])).rows[0].v,true,'lifted');
 console.log('PASS anti-abuse: e-mail confirmed only, 30 joins/hour, 3 refills/day, reports by seat, operator bans.');
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close?.();}})();
