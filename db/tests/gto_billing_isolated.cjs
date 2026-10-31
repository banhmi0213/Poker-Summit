// GTO paid plans (2026/11/01): members read only their own tier; the best of a paid plan, a trial and a coupon grant wins.
const assert=require('node:assert/strict'),{randomUUID}=require('crypto'),fs=require('fs'),path=require('path');
const folder=path.resolve(__dirname,'../../supabase/migrations'),load=s=>fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(f=>f.endsWith(s))),'utf8');
(async()=>{const db=await require('../../tests/helpers/poker-ring-database.cjs')();try{
 const sql=load('_gto_billing.sql');await db.exec(sql);await db.exec(sql);
 const a=randomUUID(),b=randomUUID();for(const m of [a,b])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[m,m+'@example.invalid']);
 const as=async(m,q,args=[])=>{await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${m}',false)`);try{return (await db.query(q,args)).rows[0]?.v;}finally{await db.exec('reset role');}};
 const st=m=>as(m,'select public.gto_plan_status() v');
 assert.deepEqual(await st(a),{tier:'free',active:false,expiresAt:null,trial:false,plan:null});
 await assert.rejects(as(a,'select count(*) v from public.gto_member_plans'),'members cannot read plan rows directly');
 await assert.rejects(as(a,"select public.gto_plan_grant($1,'full',30,'x') v",[a]),'members cannot grant themselves a plan');
 // Trial (card saved): light for 3 days.
 await db.query("insert into public.gto_member_plans(member_id,tier,period,status,trial_ends_at) values($1,'light','month','trialing',now()+interval '3 days')",[a]);
 let s=await st(a);assert.equal(s.tier,'light');assert.equal(s.trial,true);assert.equal(s.plan.status,'trialing');
 assert.equal((await st(b)).tier,'free','only the member themself');
 await assert.rejects(db.query("insert into public.gto_member_plans(member_id,tier,period,status) values($1,'full','year','pending')",[a]),'one open plan per member');
 // A full coupon beats a light trial; a later grant of the same source/ref is the same grant.
 const g1=(await db.query("select public.gto_plan_grant($1,'full',30,'store_coupon','C-1') v",[a])).rows[0].v,g2=(await db.query("select public.gto_plan_grant($1,'full',30,'store_coupon','C-1') v",[a])).rows[0].v;
 assert.equal(g1,g2,'one coupon, one grant');s=await st(a);assert.equal(s.tier,'full');assert.equal(s.trial,false);
 await assert.rejects(db.query("select public.gto_plan_grant($1,'free',30,'x')",[a]),/Invalid plan grant/);
 // Paid and cancelled: access until the paid period ends, then free.
 await db.query("insert into public.gto_member_plans(member_id,tier,period,status,cancel_at_period_end,current_period_end) values($1,'full','month','canceled',true,now()+interval '10 days')",[b]);
 s=await st(b);assert.equal(s.tier,'full');assert.equal(s.active,true);
 await db.query("update public.gto_member_plans set current_period_end=now()-interval '1 minute' where member_id=$1",[b]);assert.equal((await st(b)).tier,'free');
 // Payment failing with no paid period left: free.
 await db.query("insert into public.gto_member_plans(member_id,tier,period,status) values($1,'light','month','past_due')",[b]);assert.equal((await st(b)).tier,'free');
 // Logged out: free.
 await db.exec('set role anon');try{assert.equal((await db.query('select public.gto_plan_status() v')).rows[0].v.tier,'free');}finally{await db.exec('reset role');}
 console.log('PASS GTO plans: own status only, trial/paid/cancelled/coupon rules, no self-granting.');
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close?.();}})();
