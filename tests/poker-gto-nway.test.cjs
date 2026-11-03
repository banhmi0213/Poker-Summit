const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {NWaySolver,buildNTree}=require('../lib/poker/multiway-n-solver.ts');
const {evalCodes}=require('../lib/poker/fast-eval.ts');
const {gtoStrategy}=require('../lib/poker/gto-bot.ts');
const {reviewGto,flagHand}=require('../lib/poker/gto-review.ts');
const {loadGtoData}=require('../lib/poker/gto-data-node.ts');
const {HERO,startTrainerHand,trainerAct,trainerView}=require('../lib/poker/gto-trainer.ts');
const R='23456789TJQKA',S='cdhs',c=s=>R.indexOf(s[0])*4+S.indexOf(s[1]);

test('many-player tree: every player acts, folds remove players, terminals close the street',()=>{
 const t=buildNTree({pot:4,stack:40,betSizes:[0.5],raiseSizes:[3],maxRaises:1},4);
 assert.equal(t.kind,'act');assert.equal(t.player,0);assert.deepEqual(t.actions.map(a=>a.kind),['check','bet']);
 let ends=0;const walk=n=>{if(n.kind==='end'){ends++;assert.ok(n.folded.filter(x=>!x).length>=1);return;}n.children.forEach(walk);};walk(t);assert.ok(ends>10);
});
test('four-way river: the nuts bets much more often than air',()=>{
 const board=['Ah','Kd','7c','2s','9h'].map(c);
 const range=seed=>{let x=seed;const rnd=()=>{x=(x*16807)%2147483647;return x/2147483647;};const out=[];for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){if(board.includes(a)||board.includes(b))continue;if(rnd()<0.12)out.push({c1:a,c2:b,weight:1});}return out;};
 const s=new NWaySolver({board,pot:4,stack:40,ranges:[range(3),range(5),range(7),range(9)],betSizes:[0.5],raiseSizes:[3],maxRaises:1});
 s.run(60);
 const root=s.tree,st=s.strategy(root,true),k=root.actions.length,bi=root.actions.findIndex(a=>a.kind==='bet'),H=s.sides[0];
 const top=evalCodes([c('As'),c('Ac'),...board]),bottom=evalCodes([c('Qs'),c('Jc'),...board]);
 let sv=0,sn=0,wv=0,wn=0;for(let i=0;i<H.n;i++){const v=evalCodes([H.c1[i],H.c2[i],...board]);if(v>=top){sv+=st[i*k+bi];sn++;}else if(v<bottom){wv+=st[i*k+bi];wn++;}}
 assert.ok(sn>0&&wn>0);assert.ok(sv/sn>0.5,'strong '+sv/sn);assert.ok(wv/wn<sv/sn-0.3,'weak '+wv/wn);
});
test('four or more players on the flop: a 近似値 strategy, never graded, skipped by the flags',()=>{
 const data=loadGtoData();
 // Hero on the button: UTG/HJ/CO limp, hero limps, SB completes, BB checks — six see the flop.
 let h=startTrainerHand(4242,0);
 for(let g=0;g<20&&h.street===0;g++){const id=h.round.toAct,v=trainerView(h,id);h=trainerAct(h,id,v.legal.check?{type:'check'}:{type:'call'});}
 assert.equal(h.street,1);
 while(h.round.toAct!==HERO){const id=h.round.toAct;h=trainerAct(h,id,{type:'check'});}
 const v=trainerView(h,HERO),t0=Date.now(),s=gtoStrategy(v,data,800);
 assert.equal(s.source,'solver');assert.equal(s.approx,true);
 const sum=s.freqs.reduce((a,b)=>a+b,0);assert.ok(Math.abs(sum-1)<1e-6);assert.ok(Date.now()-t0<6000);
 assert.equal(gtoStrategy(v,data,800,false,{noApprox:true}).source,'fallback');
});
