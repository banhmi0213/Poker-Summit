// Monthly chip reset (owner 2026/10/31): on the first use in a new month (Japan time) the balance goes back to 1,000,
// the old month's closing balance is kept, and a member with chips at a table is reset only after they come back.
const assert=require('node:assert/strict'),{randomUUID}=require('crypto'),fs=require('fs'),path=require('path');
(async()=>{const db=await require('../../tests/helpers/poker-ring-database.cjs')();try{
 const dir=path.resolve(__dirname,'../../supabase/migrations');
 for(const f of ['20261031140000_poker_welcome_1000.sql','20261031160000_poker_chip_season.sql'])await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const m=randomUUID(),n=randomUUID();
 for(const id of [m,n])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,'season-'+id+'@example.invalid']);
 const as=async(who,sql)=>{await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${who}',false)`);try{return (await db.query(sql)).rows[0].v;}finally{await db.exec('reset role');}};
 assert.equal((await as(m,'select public.poker_ring_balance() v')).available,1000,'welcome 1,000');
 assert.equal((await as(n,'select public.poker_ring_balance() v')).available,1000);
 // Last month: m won up to 5,200; n is still seated with 800 at a table.
 await db.query("update poker_private.ring_accounts set available=5200,season='2026-09' where member_id=$1",[m]);
 await db.query("update poker_private.ring_accounts set available=0,in_play=800,season='2026-09' where member_id=$1",[n]);
 const b=await as(m,'select public.poker_ring_balance() v');assert.equal(b.available,1000,'reset to 1,000');assert.equal(b.history[0].kind,'reset');assert.equal(b.history[0].availableDelta,-4200);
 assert.equal(Number((await db.query("select end_balance from poker_private.ring_seasons where member_id=$1 and season='2026-09'",[m])).rows[0].end_balance),5200,'closing balance kept');
 assert.equal((await as(m,'select public.poker_ring_balance() v')).available,1000,'only once a month');
 const s=await as(n,'select public.poker_ring_balance() v');assert.equal(s.inPlay,800,'chips at a table are never taken');assert.equal(s.available,0);
 await db.query("update poker_private.ring_accounts set available=800,in_play=0 where member_id=$1",[n]);
 assert.equal((await as(n,'select public.poker_ring_balance() v')).available,1000,'reset once back from the table');
 assert.ok(Array.isArray(await as(m,'select public.poker_ring_monthly() v')),'monthly results');
 await assert.rejects(db.query("insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values($1,$2,'reset',-5,5)",[m,randomUUID()]),'a reset never moves table chips');
 console.log('PASS monthly chip reset: back to 1,000 on first use in a new month, closing balance kept, table chips untouched.');
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close?.();}})();
