// GTO paid plans (2026/11/01): KOMOJU webhook signature and plan state rules.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),{createHmac}=require('crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {verifyKomojuSignature}=require('../lib/billing/webhook-signature.ts');
const {statusFromKomoju,trialDue,cancelPlan,priceSwitchDue,noticesDue,showPriceNotice,PRICE_SWITCH_LEAD_MS}=require('../lib/billing/state.ts');
const {GTO_TRIAL_DAYS,KOMOJU_PERIOD,isPaidTier,isPeriod,normalizeTier,priceAt,laterPrice,PRO_PRICE_CHANGE_AT,PRO_PRICE_LINES}=require('../lib/billing/plans.ts');
const {proRoadmapLine}=require('../lib/billing/pro-roadmap.ts');
test('webhook signature: HMAC-SHA256 of the raw body with the webhook secret, compared safely',()=>{
 const body='{"type":"payment.captured","data":{"id":"p1"}}',secret='whsec_test',sig=createHmac('sha256',secret).update(body).digest('hex');
 assert.equal(verifyKomojuSignature(body,sig,secret),true);
 assert.equal(verifyKomojuSignature(body,sig.toUpperCase(),secret),true,'hex case does not matter');
 assert.equal(verifyKomojuSignature(body+' ',sig,secret),false,'body changed');
 assert.equal(verifyKomojuSignature(body,sig,'other'),false,'other secret');
 assert.equal(verifyKomojuSignature(body,null,secret),false);assert.equal(verifyKomojuSignature(body,sig,''),false,'no secret configured');
 assert.equal(verifyKomojuSignature(body,'zz'+sig.slice(2),secret),false,'not hex');assert.equal(verifyKomojuSignature(body,sig.slice(0,62),secret),false,'short');
});
test('prices, trial and periods match the owner decision',()=>{
 const jst=d=>Date.parse(d+'+09:00');
 assert.equal(priceAt('standard','month',jst('2026-11-01T00:00:00')),980);assert.equal(priceAt('standard','year',jst('2030-01-01T00:00:00')),9800,'スタンダード never changes');
 assert.equal(priceAt('pro','month',jst('2027-02-28T23:59:59')),1980);assert.equal(priceAt('pro','month',jst('2027-03-01T00:00:00')),2980);
 assert.equal(priceAt('pro','year',jst('2027-02-28T12:00:00')),19800);assert.equal(priceAt('pro','year',jst('2027-03-01T00:00:00')),29800);
 assert.equal(laterPrice('pro','month'),2980);assert.equal(PRO_PRICE_CHANGE_AT,jst('2027-03-01T00:00:00'));assert.equal(GTO_TRIAL_DAYS,3);
 assert.deepEqual(KOMOJU_PERIOD,{month:'monthly',year:'yearly'});
 assert.equal(isPaidTier('standard'),true);assert.equal(isPaidTier('pro'),true);assert.equal(isPaidTier('light'),false);
 assert.equal(normalizeTier('light'),'standard');assert.equal(normalizeTier('full'),'pro');assert.equal(normalizeTier('free'),null);assert.equal(isPaidTier('free'),false);assert.equal(isPeriod('year'),true);assert.equal(isPeriod('week'),false);
});
test('KOMOJU subscription states map to plan states',()=>{
 assert.equal(statusFromKomoju('active'),'active');assert.equal(statusFromKomoju('retrying'),'past_due');
 assert.equal(statusFromKomoju('suspended'),'canceled');assert.equal(statusFromKomoju('deleted'),'canceled');assert.equal(statusFromKomoju('weird'),'canceled');
});
test('trial ends: charge only trialing plans whose trial time has passed',()=>{
 const now=Date.parse('2026-11-10T00:00:00Z');
 assert.equal(trialDue({status:'trialing',trial_ends_at:'2026-11-09T23:00:00Z'},now),true);
 assert.equal(trialDue({status:'trialing',trial_ends_at:'2026-11-10T01:00:00Z'},now),false);
 assert.equal(trialDue({status:'canceled',trial_ends_at:'2026-11-09T23:00:00Z'},now),false,'cancelled in the trial is never charged');
});
test('cancel: free during the trial; paid plans stop renewing and keep access to the period end',()=>{
 const now=Date.parse('2026-11-10T00:00:00Z');
 assert.deepEqual(cancelPlan({status:'trialing',current_period_end:null},now),{status:'canceled',cancel_at_period_end:false,stopKomoju:false});
 assert.deepEqual(cancelPlan({status:'active',current_period_end:'2026-12-01T00:00:00Z'},now),{status:'canceled',cancel_at_period_end:true,stopKomoju:true});
 assert.deepEqual(cancelPlan({status:'past_due',current_period_end:'2026-11-01T00:00:00Z'},now),{status:'canceled',cancel_at_period_end:false,stopKomoju:true});
});

test('pricing text for プロ is the GTO chat wording (スタート記念価格)',()=>{
 assert.equal(PRO_PRICE_LINES.month.head,'プロ　月1,980円（スタート記念価格）');
 assert.equal(PRO_PRICE_LINES.month.change,'2027年2月末までのスタート記念価格です。2027年3月1日から月2,980円になります（今入った方も、この日から新しい料金です）。');
 assert.equal(proRoadmapLine(),'スタート記念価格のあいだに、次の内容を順番に追加します：8〜9人卓のフロップ戦略／大会の振り返りにICM／ポストフロップのベット額を増やした計算データ／「改良中」の場面（SBのリンプ・スクイーズ・3人のポット）の対応');
});
test('price switch: monthly at the first charge on/after 2027-03-01, yearly at the next renewal, once, shortly before the charge',()=>{
 const jst=d=>Date.parse(d+'+09:00');
 const row=(o={})=>({tier:'pro',period:'month',status:'active',komoju_subscription_id:'sub_1',komoju_amount:1980,current_period_end:new Date(jst('2027-03-05T10:00:00')).toISOString(),price_switch_state:null,...o});
 const next=jst('2027-03-05T10:00:00');
 assert.deepEqual(priceSwitchDue(row(),next-PRICE_SWITCH_LEAD_MS),{due:true,newAmount:2980},'within the window before the charge');
 assert.equal(priceSwitchDue(row(),next-PRICE_SWITCH_LEAD_MS-1).due,false,'too early: KOMOJU would not charge yet');
 assert.equal(priceSwitchDue(row(),next).due,false,'the charge time itself: KOMOJU charges the old subscription; not touched');
 assert.equal(priceSwitchDue(row({current_period_end:new Date(jst('2027-02-27T10:00:00')).toISOString()}),jst('2027-02-27T09:00:00')).due,false,'a February charge stays at the old price');
 assert.equal(priceSwitchDue(row({komoju_amount:2980}),next-3600000).due,false,'already at the new price');
 assert.equal(priceSwitchDue(row({price_switch_state:'creating'}),next-3600000).due,false,'in progress: never twice');
 assert.equal(priceSwitchDue(row({status:'canceled'}),next-3600000).due,false,'cancelled: nothing to renew');
 assert.equal(priceSwitchDue(row({tier:'standard',komoju_amount:980}),next-3600000).due,false,'スタンダード unchanged');
 // Yearly bought in 2026-12: the paid year keeps 19,800円; the renewal in 2027-12 is 29,800円.
 const y=row({period:'year',komoju_amount:19800,current_period_end:new Date(jst('2027-12-10T10:00:00')).toISOString()});
 assert.equal(priceSwitchDue(y,jst('2027-03-01T12:00:00')).due,false,'not on 3/1 for yearly');
 assert.deepEqual(priceSwitchDue(y,jst('2027-12-10T09:00:00')),{due:true,newAmount:29800});
});
test('price notices on 2027-02-01 and 02-22 (JST), and the player page notice until the change day',()=>{
 const jst=d=>Date.parse(d+'+09:00');
 assert.deepEqual(noticesDue(jst('2027-01-31T23:00:00')).map(n=>n.key),[]);
 assert.deepEqual(noticesDue(jst('2027-02-01T10:00:00')).map(n=>n.key),['pro-price-notice-1']);
 assert.deepEqual(noticesDue(jst('2027-02-22T10:00:00')).map(n=>n.key),['pro-price-notice-1','pro-price-notice-2']);
 assert.deepEqual(noticesDue(jst('2027-03-01T00:00:00')).map(n=>n.key),[],'no notices after the change');
 assert.equal(showPriceNotice(jst('2027-02-10T00:00:00')),true);assert.equal(showPriceNotice(jst('2027-03-02T00:00:00')),false);
});
