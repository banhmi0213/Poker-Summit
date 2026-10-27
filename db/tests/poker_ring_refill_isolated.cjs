// Free refill (owner 2026/10/27): only when the chips have run out and nothing is at a table; tops up to 3,000 once per request.
const assert=require('node:assert/strict'),{randomUUID}=require('crypto');
(async()=>{const db=await require('../../tests/helpers/poker-ring-database.cjs')();try{
 const m=randomUUID(),t=randomUUID();
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[m,'refill-'+m+'@example.invalid']);
 await db.query('insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,published) values($1,$2,6,1,2,50,400,true)',[t,'1/2']);
 const as=async(sql,args=[])=>{await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${m}',false)`);try{return (await db.query(sql,args)).rows[0];}finally{await db.exec('reset role');}};
 const bal=(await as('select public.poker_ring_balance() v')).v;assert.equal(bal.available,3000,'welcome chips');
 await assert.rejects(as('select public.poker_ring_refill($1) v',[randomUUID()]),/Refill not needed/,'no refill while chips remain');
 await db.query('update poker_private.ring_accounts set available=49 where member_id=$1',[m]);
 const req=randomUUID(),r1=(await as('select public.poker_ring_refill($1) v',[req])).v;assert.equal(r1.available,3000);
 const r2=(await as('select public.poker_ring_refill($1) v',[req])).v;assert.equal(r2.available,3000,'retry does not top up twice');
 const led=(await db.query("select available_delta from poker_private.ring_chip_ledger where member_id=$1 and kind='refill'",[m])).rows;assert.deepEqual(led.map(x=>Number(x.available_delta)),[2951]);
 await db.query('update poker_private.ring_accounts set available=0,in_play=500 where member_id=$1',[m]);
 await assert.rejects(as('select public.poker_ring_refill($1) v',[randomUUID()]),/Refill not needed/,'no refill while chips are at a table');
 await assert.rejects(db.query("insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values($1,$2,'refill',5000,0)",[m,randomUUID()]),'a refill can never exceed 3,000');
 // At a bigger table: 200 left is below its 250 minimum, so 「補充して座り直す」 there may top up; without the table it may not.
 const big=randomUUID();await db.query('insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,published) values($1,$2,6,5,10,250,2000,true)',[big,'5/10']);
 await db.query('update poker_private.ring_accounts set available=200,in_play=0 where member_id=$1',[m]);
 await assert.rejects(as('select public.poker_ring_refill($1) v',[randomUUID()]),/Refill not needed/,'200 still covers the 1/2 table');
 assert.equal((await as('select public.poker_ring_refill($1,$2) v',[randomUUID(),big])).v.available,3000,'200 is short of the 5/10 table minimum');
 await db.query('update poker_private.ring_accounts set available=0 where member_id=$1',[m]);
 await assert.rejects(as('select public.poker_ring_refill($1,$2) v',[randomUUID(),randomUUID()]),/Table unavailable/);
 console.log('PASS free refill: only when out of chips and not seated, exactly to 3,000, idempotent per request, ledger-checked.');
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close?.();}})();
