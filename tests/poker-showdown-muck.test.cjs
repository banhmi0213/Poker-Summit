// Showdown without an all-in (owner 2026/10/29): the winner and the second-best hand are shown; a chop shows only the
// players who chop; everyone else mucks - their cards never leave the server, and the hand history marks them unshown.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {AuthoritativeHand}=require('../lib/poker/authoritative-hand.ts'),{bestOfSeven,compareScores}=require('../lib/poker/engine.ts'),{buildHandHistory}=require('../lib/poker/hand-history.ts');
const terms={sb:50,bb:100,level:0,index:0,ante:0,anteType:'none'};
function play(n,seed){let r=seed;const rand=()=>(r=(r*9301+49297)%233280)/233280;const h=new AuthoritativeHand(Array.from({length:n},(_,i)=>({id:'seat-'+(i+1),stack:10000})),seed%n,terms);let i=0;
 while(!h.snapshot(null).result){const s=h.snapshot(null),me=h.snapshot(s.toAct).legal;h.act(s.toAct,{handId:s.handId,revision:s.revision,actionId:'a'+i++,action:me.check?{type:'check'}:rand()<0.15&&s.players.filter(p=>!p.folded).length>2?{type:'fold'}:{type:'call'}});}return h;}
test('river showdowns show the winner and the second-best hand, a chop shows only the choppers, the rest muck',()=>{
 let checked=0,mucked=0,chops=0;
 for(let seed=1;seed<=600;seed++){const h=play(3+seed%4,seed),s=h.snapshot(null);if(!s.result.showdown)continue;
  const cp=h.checkpoint(),live=s.players.filter(p=>!p.folded),score=id=>bestOfSeven([...cp.deal.holes[id],...cp.deal.board]),win=s.result.winners;
  let expected;if(win.length>1){expected=[...win];chops++;}else{const rest=live.filter(p=>!win.includes(p.id));const top=rest.reduce((a,b)=>compareScores(score(b.id),score(a.id))>0?b:a,rest[0]);expected=[...win,...rest.filter(p=>compareScores(score(p.id),score(top.id))===0).map(p=>p.id)];}
  const shown=live.filter(p=>p.hole!==null).map(p=>p.id);assert.deepEqual(shown.sort(),expected.sort());
  for(const p of live)if(!expected.includes(p.id)){mucked++;assert.equal(p.hole,null);assert.equal(h.snapshot(p.id).players.find(x=>x.id===p.id).hole.length,2);for(const other of live.filter(o=>o.id!==p.id))assert.equal(h.snapshot(other.id).players.find(x=>x.id===p.id).hole,null,'nobody else sees a mucked hand');}
  const history=buildHandHistory(cp,Object.fromEntries(s.players.map(p=>[p.id,'m-'+p.id])));for(const p of history.players)assert.equal(p.shown,!p.folded&&expected.includes(p.seatId));
  checked++;}
 assert.ok(checked>200&&mucked>50&&chops>0,`checked ${checked} mucked ${mucked} chops ${chops}`);
});
test('an all-in showdown still turns every live hand face up',()=>{
 const h=new AuthoritativeHand([{id:'seat-1',stack:1000},{id:'seat-2',stack:1000},{id:'seat-3',stack:1000}],0,terms);let i=0;
 while(!h.snapshot(null).result){const s=h.snapshot(null),me=h.snapshot(s.toAct).legal;h.act(s.toAct,{handId:s.handId,revision:s.revision,actionId:'x'+i++,action:me.raise?{type:'raise',amount:me.maxRaiseTo}:{type:'call'}});}
 const s=h.snapshot(null);assert.ok(s.result.showdown);assert.ok(s.players.filter(p=>!p.folded).every(p=>p.hole&&p.hole.length===2));
});
