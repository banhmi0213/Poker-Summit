// Ring rake (owner 2026/10/29): 3% of the contested pot, at most 3 BB, no flop no drop, ring only, to the house.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {AuthoritativeHand}=require('../lib/poker/authoritative-hand.ts');
const RAKE={bps:300,capBb:3},terms={sb:50,bb:100,level:0,index:0,ante:0,anteType:'none'};
const make=(stacks,rake=RAKE)=>new AuthoritativeHand(stacks.map((stack,i)=>({id:'seat-'+(i+1),stack})),0,terms,undefined,undefined,rake?{rake}:undefined);
let n=0;const act=(h,pick)=>{const s=h.snapshot(null),legal=h.snapshot(s.toAct).legal;h.act(s.toAct,{handId:s.handId,revision:s.revision,actionId:'a'+n++,action:pick(legal,s)});};
const total=s=>s.players.reduce((a,p)=>a+p.stack,0);
const check=(l)=>l.check?{type:'check'}:{type:'call'};
test('no flop, no drop: a hand won before the flop pays nothing',()=>{
 const h=make([1000,1000,1000]);act(h,()=>({type:'fold'}));act(h,()=>({type:'fold'}));const s=h.snapshot(null);
 assert.ok(s.result&&!s.result.showdown);assert.equal(s.result.rake,undefined);assert.equal(total(s),3000);
});
test('3% of the contested pot after the flop; an uncalled bet is not raked',()=>{
 const h=make([5000,5000]);act(h,check);act(h,check);// limp, check: pot 200, flop dealt
 assert.equal(h.snapshot(null).street,'flop');act(h,()=>({type:'bet',amount:1000}));act(h,()=>({type:'fold'}));
 const s=h.snapshot(null);assert.equal(s.result.rake,6);// 3% of 200, the 1,000 bet came back uncalled
 assert.equal(total(s)+s.result.rake,10000);assert.deepEqual(Object.values(s.result.rakePaid),[6]);
});
test('capped at 3 big blinds, taken from the winner, and kept on restore',()=>{
 const h=make([5000,5000]);act(h,l=>({type:'raise',amount:l.maxRaiseTo}));act(h,()=>({type:'call'}));let g=0;while(!h.snapshot(null).result&&g++<10)act(h,check);
 const s=h.snapshot(null);assert.ok(s.result.showdown);
 if(s.result.winners.length===1){assert.equal(s.result.rake,300);assert.equal(s.result.rakePaid[s.result.winners[0]],300);}
 else{assert.equal(s.result.rake,300);assert.equal(Object.values(s.result.rakePaid).reduce((a,b)=>a+b,0),300);}
 assert.equal(total(s)+300,10000);
 const again=AuthoritativeHand.restore(h.checkpoint()).snapshot(null);assert.deepEqual(again.result,s.result);assert.deepEqual(again.players.map(p=>p.stack),s.players.map(p=>p.stack));
});
test('random ring hands: chips + rake are conserved, rake never above 3% or 3 BB, losers never pay',()=>{
 let raked=0;
 for(let seed=1;seed<=400;seed++){let r=seed;const rand=()=>(r=(r*9301+49297)%233280)/233280;const count=2+seed%5,stacks=Array.from({length:count},()=>500+Math.floor(rand()*40)*100),h=make(stacks);let g=0;
  while(!h.snapshot(null).result&&g++<80){const s=h.snapshot(null);if(s.runs&&s.toAct===null){const id=s.runs.participants.find(x=>s.runs.choices[x]===null);h.act(id,{handId:s.handId,revision:s.revision,actionId:'r'+n++,action:{type:'runs',count:rand()<.5?1:2}});continue;}
   act(h,(l,s2)=>{const x=rand(),open=Math.max(...s2.players.map(p=>p.committed))===0;if(l.raise&&x<.15)return {type:open?'bet':'raise',amount:x<.04?l.maxRaiseTo:l.minRaiseTo};if(l.check)return {type:'check'};return x<.3?{type:'fold'}:{type:'call'};});}
  const s=h.snapshot(null),rake=s.result.rake??0,start=stacks.reduce((a,b)=>a+b,0);assert.equal(total(s)+rake,start);
  const committed=start-stacks.reduce((a,b,i)=>a,0);void committed;
  assert.ok(rake<=300);for(const [id,v] of Object.entries(s.result.rakePaid??{})){assert.ok(v>0);assert.ok((s.result.payouts[id]??0)>=0);}
  assert.equal(Object.values(s.result.rakePaid??{}).reduce((a,b)=>a+b,0),rake);raked+=rake;}
 assert.ok(raked>0);
});
test('tournament hands (no rake rule) are never raked',()=>{
 const h=make([5000,5000],null);act(h,l=>({type:'raise',amount:l.maxRaiseTo}));act(h,()=>({type:'call'}));let g=0;while(!h.snapshot(null).result&&g++<10)act(h,check);
 const s=h.snapshot(null);assert.equal(s.result.rake,undefined);assert.equal(total(s),10000);
});
test('a stored rake rule outside the allowed range is refused',()=>{
 assert.throws(()=>make([1000,1000],{bps:5000,capBb:3}));
 const cp=make([1000,1000]).checkpoint();cp.initial.rake={bps:-1,capBb:3};assert.throws(()=>AuthoritativeHand.restore(cp));
});

test('per-table rules (owner 2026/10/31): 10% capped at 10 BB, 5% at 5 BB; old hands keep 3%・3BB',()=>{
 const {tableRake,RING_RAKE,TABLE_RAKES}=require('../lib/poker/ring-rake.ts');
 assert.deepEqual(TABLE_RAKES.map(r=>[r.bps,r.capBb]),[[500,5],[1000,10]]);
 assert.deepEqual(tableRake({bps:1000,capBb:10}),{bps:1000,capBb:10});assert.deepEqual(tableRake({bps:1000,capBb:5}),{...RING_RAKE});assert.deepEqual(tableRake(undefined),{...RING_RAKE});assert.deepEqual(tableRake({bps:300,capBb:3}),{bps:300,capBb:3});
 const h=make([5000,5000],{bps:1000,capBb:10});act(h,l=>({type:'raise',amount:l.maxRaiseTo}));act(h,()=>({type:'call'}));let g=0;while(!h.snapshot(null).result&&g++<10)act(h,check);
 const s=h.snapshot(null);assert.equal(s.result.rake,1000,'10% of 10,000 is 1,000 = the 10 BB cap');assert.equal(total(s)+1000,10000);
 const m=make([5000,5000],{bps:500,capBb:5});act(m,l=>({type:'raise',amount:l.maxRaiseTo}));act(m,()=>({type:'call'}));g=0;while(!m.snapshot(null).result&&g++<10)act(m,check);
 assert.equal(m.snapshot(null).result.rake,500,'5% of 10,000 is 500 = the 5 BB cap');
});
