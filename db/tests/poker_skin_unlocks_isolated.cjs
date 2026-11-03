// Skin unlocks (owner 2026/10/31): one free starter pick of a table, card face and card back; then one free pick per
// ring-hand milestone (cards 100/300/600/1,000/1,500, tables 2,000/3,000/5,000; owner 2026/11/03). Owned skins are member_tickets rows like shop skins.
const assert=require('node:assert/strict'),{randomUUID}=require('crypto'),fs=require('fs'),path=require('path');
const folder=path.resolve(__dirname,'../../supabase/migrations'),load=s=>fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(f=>f.endsWith(s))),'utf8');
(async()=>{const db=await require('../../tests/helpers/poker-ring-database.cjs')();try{
 await db.exec(load('_poker_skin_shop.sql'));const sql=load('_poker_skin_unlocks.sql');await db.exec(sql);await db.exec(sql);const hands=load('_poker_skins_hands_only.sql');await db.exec(hands);await db.exec(hands);
 const m=randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[m,m+'@example.invalid']);
 const as=async(q,args=[])=>{await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${m}',false)`);try{return (await db.query(q,args)).rows[0].v;}finally{await db.exec('reset role');}};
 let s=await as('select public.poker_skin_status() v');
 assert.equal(s.starterDone,false);assert.equal(s.hands,0);assert.deepEqual(s.milestones,[100,300,600,1000,1500,2000,3000,5000]);assert.deepEqual(s.cardMilestones,[100,300,600,1000,1500]);assert.deepEqual(s.tableMilestones,[2000,3000,5000]);assert.ok(!(await as('select public.poker_shop() v')).items.some(i=>i.kind==='skin'),'skins are not in the chip shop (owner 2026/11/03)');assert.equal(s.picksEarned,0);assert.deepEqual(s.owned,[]);
 await assert.rejects(as('select public.poker_skin_starter($1,$2,$3) v',['card_back_onyx',null,null]),/Invalid skin/,'a card back is not a table');
 await assert.rejects(as('select public.poker_skin_starter($1,$2,$3) v',['table_nope',null,null]),/Invalid skin/,'unknown items are refused');
 s=await as('select public.poker_skin_starter($1,$2,$3) v',['table_forest',null,'card_back_ivory']);
 assert.equal(s.starterDone,true);assert.deepEqual(s.owned,['card_back_ivory','table_forest'],'standard face needs no grant');
 await assert.rejects(as('select public.poker_skin_starter($1,$2,$3) v',['table_navy',null,null]),/Starter already chosen/,'only once');
 assert.equal((await as('select public.poker_shop() v')).tickets.table_forest,1,'owned like an exchanged skin');
 await assert.rejects(as('select public.poker_shop_exchange($1,1,$2) v',['table_forest',randomUUID()]),/Already owned|Item unavailable/,'no paying for a starter pick');
 await assert.rejects(as('select public.poker_skin_milestone_claim($1,$2) v',['table_navy',randomUUID()]),/No picks left/,'no picks before 100 hands');
 // 100 ring hands played: one settlement row per hand.
 // Replica mode skips foreign keys and the ledger's triggers; its check constraints still apply.
 await db.exec('set session_replication_role=replica');
 for(let i=0;i<100;i++)await db.query("insert into poker_private.ring_chip_ledger(member_id,request_id,kind,reservation_id,hand_id,available_delta,in_play_delta) values($1,$2,'settlement',$3,$4,0,0)",[m,randomUUID(),randomUUID(),randomUUID()]);
 await db.exec('set session_replication_role=origin');
 s=await as('select public.poker_skin_status() v');assert.equal(s.hands,100);assert.equal(s.picksEarned,1);assert.equal(s.picksUsed,0);
 await assert.rejects(as('select public.poker_skin_milestone_claim($1,$2) v',['table_forest',randomUUID()]),/Already owned/);
 const req=randomUUID();s=await as('select public.poker_skin_milestone_claim($1,$2) v',['card_front_royal',req]);
 assert.equal(s.picksUsed,1);assert.ok(s.owned.includes('card_front_royal'));
 s=await as('select public.poker_skin_milestone_claim($1,$2) v',['card_front_royal',req]);assert.equal(s.picksUsed,1,'a retried request takes one pick');
 await assert.rejects(as('select public.poker_skin_milestone_claim($1,$2) v',['table_navy',randomUUID()]),/No picks left/,'tables come at 2,000 hands');
 await assert.rejects(as('select public.poker_skin_milestone_claim($1,$2) v',['card_back_onyx',randomUUID()]),/No picks left/,'one card pick at 100 hands');
 await assert.rejects(as('select count(*) v from poker_private.skin_grants'),'grants are private');
 console.log('PASS skin unlocks: one starter pick per category, hand-count picks, owned like exchanged skins.');
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close?.();}})();
