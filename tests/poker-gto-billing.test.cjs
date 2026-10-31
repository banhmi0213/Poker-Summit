// GTO paid plans (2026/11/01): KOMOJU webhook signature and plan state rules.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),{createHmac}=require('crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {verifyKomojuSignature}=require('../lib/billing/webhook-signature.ts');
const {statusFromKomoju,trialDue,cancelPlan}=require('../lib/billing/state.ts');
const {GTO_PRICES,GTO_TRIAL_DAYS,KOMOJU_PERIOD,isPaidTier,isPeriod}=require('../lib/billing/plans.ts');
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
 assert.deepEqual(GTO_PRICES,{light:{month:980,year:9800},full:{month:1980,year:19800}});assert.equal(GTO_TRIAL_DAYS,3);
 assert.deepEqual(KOMOJU_PERIOD,{month:'monthly',year:'yearly'});
 assert.equal(isPaidTier('light'),true);assert.equal(isPaidTier('free'),false);assert.equal(isPeriod('year'),true);assert.equal(isPeriod('week'),false);
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
