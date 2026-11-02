// Skins in the chip exchange: once per member, kept for good, never spent by game actions.
const assert=require('node:assert/strict'),{randomUUID}=require('crypto'),fs=require('fs'),path=require('path');
const folder=path.resolve(__dirname,'../../supabase/migrations'),load=s=>fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(f=>f.endsWith(s))),'utf8');
(async()=>{const db=await require('../../tests/helpers/poker-ring-database.cjs')();try{
 const sql=load('_poker_skin_shop.sql');await db.exec(sql);await db.exec(sql);
 const m=randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[m,m+'@example.invalid']);
 const as=async(q,args=[])=>{await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${m}',false)`);try{return (await db.query(q,args)).rows[0].v;}finally{await db.exec('reset role');}};
 const view=await as('select public.poker_shop() v');
 const forest=view.items.find(i=>i.code==='table_forest');assert.equal(forest.kind,'skin');assert.equal(forest.price,3000);
 assert.equal(view.items.filter(i=>i.kind==='skin').length,8);
 await assert.rejects(as('select public.poker_shop_exchange($1,2,$2) v',['card_back_onyx',randomUUID()]),/Invalid exchange/,'one at a time');
 const after=await as('select public.poker_shop_exchange($1,1,$2) v',['card_back_onyx',randomUUID()]);
 assert.equal(after.tickets.card_back_onyx,1);assert.equal(after.available,3000-1500);
 await assert.rejects(as('select public.poker_shop_exchange($1,1,$2) v',['card_back_onyx',randomUUID()]),/Already owned/,'only once');
 await db.exec('set role service_role');
 assert.equal((await db.query('select public.poker_ticket_use($1,$2,$3) v',[m,'card_back_onyx','hand-1'])).rows[0].v,false,'skins are never spent');
 await db.exec('reset role');
 assert.equal((await as('select public.poker_shop() v')).tickets.card_back_onyx,1,'still owned');
 console.log('PASS skin shop: priced skins, one per member, kept for good.');
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close?.();}})();
