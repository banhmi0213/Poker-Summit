const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {AuthoritativeHand}=require('../lib/poker/authoritative-hand.ts');
const {ringTerms}=require('../lib/poker/tournament-hand.ts');
const seats=['a','b','c','d','e','f'],make=(ids=seats,stack=1000,terms=ringTerms)=>new AuthoritativeHand(ids.map(id=>({id,stack})),ids.length-1,terms);
const command=(s,action,id='x')=>({handId:s.handId,revision:s.revision,actionId:id,action});
const play=(h,action,id)=>{const s=h.snapshot(null);return h.act(s.toAct,command(s,action,id));};
const passive=s=>s.legal.check?{type:'check'}:{type:'call'};
function conserved(s,total){assert.equal(s.players.reduce((n,p)=>n+p.stack,0)+s.pot,total);}
test('personalized and spectator snapshots hide opponents, future board, deck and receipts',()=>{
 const h=make();for(const viewer of [null,...seats]){const s=h.snapshot(viewer);assert.deepEqual(s.board,[]);for(const p of s.players)assert.equal(p.hole===null,p.id!==viewer);assert.ok(!JSON.stringify(s).includes('deck'));assert.ok(!JSON.stringify(s).includes('receipts'));}
 assert.equal(JSON.stringify(h),'{}');assert.throws(()=>h.snapshot('outsider'));assert.notEqual(h.snapshot(null).handId,make().snapshot(null).handId);
});
test('snapshots are isolated copies including cards, terms and positions',()=>{
 const h=make(),a=h.snapshot('a'),saved=h.snapshot('a');a.players[0].stack=99999;a.players[0].hole[0].rank=99;a.terms.bb=1;a.positions.bb='x';assert.deepEqual(h.snapshot('a'),saved);
});
test('only authenticated actor may act; invalid commands preserve complete state',()=>{
 const h=make(),s=h.snapshot(null),wrong=seats.find(id=>id!==s.toAct);
 for(const [actor,cmd] of [[wrong,command(s,{type:'call'})],['outsider',command(s,{type:'call'})],[s.toAct,{...command(s,{type:'call'}),actorId:wrong}],[s.toAct,{...command(s,{type:'call'}),deck:[]}],[s.toAct,command(s,{type:'check'})],[s.toAct,command(s,{type:'raise',amount:NaN})],[s.toAct,command(s,{type:'call',amount:100})],[s.toAct,command(s,{type:'allin'})],[s.toAct,null]]){assert.throws(()=>h.act(actor,cmd));assert.deepEqual(h.snapshot(null),s);}
});
test('stale versions and wrong hand IDs reject delayed packets without debiting chips',()=>{
 const h=make(),s=h.snapshot(null);play(h,{type:'call'},'first');const after=h.snapshot(null);
 assert.throws(()=>h.act(after.toAct,command(s,{type:'call'},'late')),/Stale/);assert.throws(()=>h.act(after.toAct,{...command(after,{type:'call'}),handId:'another'}),/Wrong hand/);assert.deepEqual(h.snapshot(null),after);
});
test('exact retries are idempotent after newer actions and return current reconnect state',()=>{
 const h=make(),s=h.snapshot(null),c=command(s,{type:'call'},'retry');const first=h.act(s.toAct,c);play(h,{type:'call'},'newer');const latest=h.snapshot(s.toAct),retry=h.act(s.toAct,c);
 assert.equal(retry.replayed,true);assert.equal(retry.acceptedRevision,first.acceptedRevision);assert.deepEqual(retry.state,latest);assert.equal(retry.state.revision,2);assert.throws(()=>h.act(s.toAct,{...c,action:{type:'fold'}}),/reused/);
});
test('a second competing command for one version fails; receipts are scoped per actor',()=>{
 const h=make(),s=h.snapshot(null);play(h,{type:'call'},'same-id');const after=h.snapshot(null);assert.throws(()=>h.act(s.toAct,command(s,{type:'fold'},'second')),/Stale/);h.act(after.toAct,command(after,{type:'call'},'same-id'));assert.equal(h.snapshot(null).revision,2);
});
test('street transitions expose 0/3/4/5 board cards, then reveal only non-folded hands',()=>{
 const h=make();const first=h.snapshot(null);h.act(first.toAct,command(first,{type:'fold'},'fold'));const folded=first.toAct,seen=new Set();
 for(let i=0;i<50;i++){const s=h.snapshot(null);seen.add(s.street);if(s.result){assert.equal(s.result.showdown,true);assert.equal(s.players.find(p=>p.id===folded).hole,null);assert.equal(h.snapshot(folded).players.find(p=>p.id===folded).hole.length,2);assert.ok(s.players.filter(p=>!p.folded).every(p=>p.hole.length===2));break;}
 assert.equal(s.board.length,{preflop:0,flop:3,turn:4,river:5}[s.street]);assert.ok(s.players.every(p=>p.hole===null));const v=h.snapshot(s.toAct);h.act(s.toAct,command(s,passive(v),'p'+i));conserved(h.snapshot(null),6000);}
 assert.deepEqual([...seen],['preflop','flop','turn','river','showdown']);
});
test('fold victory pays once, reveals no opponent hand or future community cards',()=>{
 const h=make(['a','b']),s=h.snapshot(null),c=command(s,{type:'fold'});h.act(s.toAct,c);const done=h.snapshot(null);assert.ok(done.result);assert.equal(done.result.showdown,false);assert.equal(done.board.length,0);assert.ok(done.players.every(p=>p.hole===null));conserved(done,2000);h.act(s.toAct,c);assert.deepEqual(h.snapshot(null),done);assert.throws(()=>h.act('a',command(done,{type:'check'},'after')),/settled/);
});
test('heads-up all-in runs all streets server-side and reveals only at settlement',()=>{
 const h=make(['a','b'],200);let s=h.snapshot(null);const v=h.snapshot(s.toAct);h.act(s.toAct,command(s,{type:'raise',amount:v.legal.maxRaiseTo},'all-in'));s=h.snapshot(null);h.act(s.toAct,command(s,{type:'call'},'call'));const end=h.snapshot(null);assert.equal(end.street,'showdown');assert.equal(end.board.length,5);assert.ok(end.players.every(p=>p.hole.length===2));conserved(end,400);
});
test('forced all-ins settle during creation, including BB and per-player antes',()=>{
 for(const anteType of ['bb','per-player']){const h=make(['a','b'],50,{...ringTerms,ante:50,anteType}),s=h.snapshot(null);assert.ok(s.result);assert.equal(s.board.length,5);conserved(s,100);}
});
test('100 complete server-owned hands conserve chips and hide every private hand until showdown',()=>{
 let seed=17;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let n=0;n<100;n++){const count=2+rand(5),h=make(seats.slice(0,count),300+rand(1000),{...ringTerms,ante:25,anteType:n%2?'bb':'per-player'}),initial=h.snapshot(null),total=initial.players.reduce((v,p)=>v+p.stack,0)+initial.pot;
 for(let k=0;;k++){assert.ok(k<300);const s=h.snapshot(null);conserved(s,total);if(s.result)break;assert.ok(s.players.every(p=>p.hole===null));const v=h.snapshot(s.toAct),r=rand(12);const action=r===0?{type:'fold'}:r===1&&v.legal.raise?{type:s.street==='preflop'?'raise':'bet',amount:v.legal.maxRaiseTo}:passive(v);
 // A postflop round may already have a wager from a prior actor.
 if(action.type==='bet'&&!v.legal.check)action.type='raise';h.act(s.toAct,command(s,action,'sim'+k));}
 }
});
test('invalid server seating and unsafe stacks fail before creating a playable hand',()=>{
 assert.throws(()=>make(['a','a']));assert.throws(()=>make(['a','b'],0));assert.throws(()=>make(['a','b'],Number.MAX_SAFE_INTEGER));assert.throws(()=>make(['a:spoof','b']));assert.throws(()=>make(['__proto__','b']));assert.throws(()=>make(['constructor','b']));
});
