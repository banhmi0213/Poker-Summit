// Member cosmetics (owner 2026/11/01): アイコン枠・ネームプレート・サミットのスレッドデザイン. Looks only; owned like skins
// (member_tickets count 1); until sales start everyone may equip every design; the choice is public through codes only.
const assert=require('node:assert/strict'),{randomUUID}=require('crypto'),fs=require('fs'),path=require('path');
const folder=path.resolve(__dirname,'../../supabase/migrations'),load=s=>fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(f=>f.endsWith(s))),'utf8');
(async()=>{const db=await require('../../tests/helpers/poker-ring-database.cjs')();try{
 await db.exec('create schema if not exists poker_display');
 await db.exec(load('_poker_skin_shop.sql'));const sql=load('_cosmetics_frames.sql');await db.exec(sql);await db.exec(sql);
 const m=randomUUID(),o=randomUUID();for(const id of [m,o])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 const as=async(who,q,args=[])=>{await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${who}',false)`);try{return (await db.query(q,args)).rows[0].v;}finally{await db.exec('reset role');}};
 let s=await as(m,'select public.poker_cosmetics_status() v');
 assert.deepEqual(s.equipped,{frame:null,plate:null,thread:null});assert.deepEqual(s.owned,[]);assert.equal(s.freeForNow,true);
 // Not for sale yet: none of them is in the chip exchange.
 assert.ok(!(await as(m,'select public.poker_shop() v')).items.some(i=>i.kind==='cosmetic'),'no prices until sales start');
 s=await as(m,'select public.poker_cosmetics_equip($1,$2,$3) v',['frame_gold','plate_sakura','thread_navy']);
 assert.deepEqual(s.equipped,{frame:'frame_gold',plate:'plate_sakura',thread:'thread_navy'});
 await assert.rejects(as(m,'select public.poker_cosmetics_equip($1,$2,$3) v',['plate_gold',null,null]),/Invalid cosmetic/,'a plate is not a frame');
 await assert.rejects(as(m,'select public.poker_cosmetics_equip($1,$2,$3) v',['frame_nope',null,null]),/Invalid cosmetic/,'unknown designs are refused');
 await assert.rejects(as(m,'select public.poker_cosmetics_equip($1,$2,$3) v',['table_forest',null,null]),/Invalid cosmetic/,'skins are not cosmetics');
 // Others see the codes only (no e-mail or other member data).
 const seen=await as(o,'select public.poker_cosmetics_for($1) v',[[m,o]]);
 assert.deepEqual(seen,[{userId:m,frame:'frame_gold',plate:'plate_sakura',thread:'thread_navy'}]);
 await db.exec('set role anon');try{assert.equal((await db.query('select public.poker_cosmetics_for($1) v',[[m]])).rows[0].v.length,1,'the board is public');}finally{await db.exec('reset role');}
 // Back to standard.
 s=await as(m,'select public.poker_cosmetics_equip($1,$2,$3) v',[null,null,null]);assert.deepEqual(s.equipped,{frame:null,plate:null,thread:null});
 // After sales start (free-for-now off), only owned designs can be chosen.
 await db.exec("create or replace function poker_private.cosmetics_free_for_now() returns boolean language sql immutable set search_path='' as 'select false'");
 await assert.rejects(as(m,'select public.poker_cosmetics_equip($1,$2,$3) v',['frame_gold',null,null]),/Invalid cosmetic/,'not owned');
 await db.query("insert into poker_private.member_tickets(member_id,item,count) values($1,'frame_gold',1)",[m]);
 s=await as(m,'select public.poker_cosmetics_equip($1,$2,$3) v',['frame_gold',null,null]);assert.equal(s.equipped.frame,'frame_gold');assert.deepEqual(s.owned,['frame_gold']);
 await assert.rejects(as(m,'select count(*) v from poker_private.member_cosmetics'),'the table itself is private');
 console.log('PASS cosmetics: equip validated by kind and ownership, public through codes only, not sold yet.');
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close?.();}})();
