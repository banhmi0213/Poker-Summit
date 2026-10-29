const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {AuthoritativeHand}=require('../lib/poker/authoritative-hand.ts'),{optimisticRingPlay}=require('../lib/poker/ring-optimistic.ts');
const terms={sb:50,bb:100,level:0,index:0,ante:0,anteType:'none'};
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/2**32;};}
function choose(legal,r,hand){const open=Math.max(...hand.players.map(p=>p.committed))===0;const x=r();if(legal.raise&&x<0.2){const lo=legal.minRaiseTo,hi=legal.maxRaiseTo;return {type:open?'bet':'raise',amount:x<0.04?hi:Math.min(hi,lo+Math.floor(r()*(hi-lo+1)/4))};}if(legal.check)return {type:'check'};if(x<0.35)return {type:'fold'};return {type:'call'};}
test('your own move shows the same chips, fold/all-in and next player as the server (6-max random hands)',()=>{
 let moves=0,actorHits=0,actorChecks=0;
 for(let seed=1;seed<=400;seed++){const r=rng(seed),n=2+seed%5,stacks=Array.from({length:n},(_,i)=>({id:'seat-'+(i+1),stack:500+Math.floor(r()*20)*100}));
  const h=new AuthoritativeHand(stacks,seed%n,terms);let guard=0;
  while(!h.snapshot(null).result&&guard++<200){const s0=h.snapshot(null);if(!s0.toAct)break;const me=s0.toAct,before=h.snapshot(me),action=choose(before.legal,r,before);
   const command={handId:before.handId,revision:before.revision,actionId:'a'+guard,action};
   const play={viewerSeat:me,serverNow:0,deadline:10000,hand:before};const view=optimisticRingPlay(play,command);
   h.act(me,command);const after=h.snapshot(me);moves++;
   assert.equal(view.hand.revision,after.revision);assert.equal(view.deadline,null);assert.equal(view.hand.legal,null);
   const sameStreet=after.street===before.street&&!after.result;
   for(const p of view.hand.players){const q=after.players.find(x=>x.id===p.id);assert.equal(p.folded,q.folded);assert.equal(p.allIn,q.allIn,`allIn ${p.id}`);assert.equal(p.totalCommitted,q.totalCommitted);if(sameStreet){assert.equal(p.committed,q.committed);assert.equal(p.stack,q.stack);}}
   if(sameStreet)assert.equal(view.hand.pot,after.pot);
   actorChecks++;if(sameStreet?view.hand.toAct===after.toAct:view.hand.toAct===null)actorHits++;
  }}
 assert.ok(moves>2000,`moves ${moves}`);
 // The next-player guess only places the ring early; the server state replaces it a moment later.
 assert.equal(actorHits,actorChecks,`next player guessed ${actorHits}/${actorChecks}`);
});
test('stale, foreign or illegal commands leave the server view untouched',()=>{
 const h=new AuthoritativeHand([{id:'seat-1',stack:1000},{id:'seat-2',stack:1000}],0,terms),s0=h.snapshot(null),me=s0.toAct,other=me==='seat-1'?'seat-2':'seat-1';
 const mine={viewerSeat:me,serverNow:0,deadline:10000,hand:h.snapshot(me)},theirs={viewerSeat:other,serverNow:0,deadline:10000,hand:h.snapshot(other)};
 const c=a=>({handId:s0.handId,revision:s0.revision,actionId:'x',action:a});
 assert.equal(optimisticRingPlay(mine,null),mine);
 assert.equal(optimisticRingPlay(mine,{...c({type:'call'}),revision:s0.revision+1}),mine);
 assert.equal(optimisticRingPlay(mine,{...c({type:'call'}),handId:'other'}),mine);
 assert.equal(optimisticRingPlay(theirs,c({type:'call'})),theirs);
 assert.equal(optimisticRingPlay(mine,c({type:'check'})),mine);
 assert.equal(optimisticRingPlay(mine,c({type:'raise',amount:99999})),mine);
 assert.equal(optimisticRingPlay({...mine,spectating:true},c({type:'call'})).hand.revision,s0.revision);
 const v=optimisticRingPlay(mine,c({type:'fold'}));assert.equal(v.hand.players.find(p=>p.id===me).folded,true);assert.equal(v.hand.toAct,null);
});
