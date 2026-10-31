const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {rakeTaken}=require('../lib/poker/preflop-solver.ts');
const {RAKE_CHARTS,RING_RAKE,rakeKey}=require('../lib/poker/ring-rake.ts');
const {loadGtoData}=require('../lib/poker/gto-data-node.ts');
const {gtoStrategy}=require('../lib/poker/gto-bot.ts');
const {startTrainerHand,trainerView,HERO}=require('../lib/poker/gto-trainer.ts');
const chart=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','public','poker-gto',f),'utf8'));
const combos=l=>l.length===2?6:l[2]==='s'?4:12;
const share=(n,a)=>{let t=0,all=0;for(const [l,v] of Object.entries(n.strategy)){all+=combos(l);t+=combos(l)*v[a];}return t/all;};

test('rake: only up to the cap, never more than the pot, nothing without a rule',()=>{
 assert.equal(rakeTaken(undefined,10,'srp'),0);
 assert.equal(rakeTaken({bps:300,capBb:3},5.5,'srp'),5.5*2.5*0.03);
 assert.equal(rakeTaken({bps:1000,capBb:10},40,'allin'),4);
 assert.equal(rakeTaken({bps:1000,capBb:3},100,'allin'),3);
});

test('every rake level has a chart with the same decisions, and more rake plays tighter',()=>{
 const base=chart('preflop.json');assert.ok(RAKE_CHARTS.some(r=>rakeKey(r)===rakeKey(RING_RAKE)));
 const btn=[share(base.nodes.find(n=>n.kind==='open'&&n.player==='BTN'),1)],bbFold=[share(base.nodes.find(n=>n.id===12),0)];
 for(const r of RAKE_CHARTS){const c=chart(`preflop-rake${r.bps}-${r.capBb}.json`);
  assert.equal(c.nodes.length,base.nodes.length);assert.deepEqual(c.rake,{bps:r.bps,capBb:r.capBb});
  assert.deepEqual(c.nodes.map(n=>n.history),base.nodes.map(n=>n.history));
  btn.push(share(c.nodes.find(n=>n.kind==='open'&&n.player==='BTN'),1));bbFold.push(share(c.nodes.find(n=>n.history===base.nodes.find(x=>x.id===12).history),0));}
 // The big blind defends less as rake goes up; the button opens less than with no rake (at high rake the blinds fold
 // so often that stealing pays again, so the button is not strictly tighter level by level).
 for(let i=1;i<bbFold.length;i++)assert.ok(bbFold[i]>bbFold[i-1],'BB folds more with more rake '+bbFold);
 for(let i=1;i<btn.length;i++)assert.ok(btn[i]<btn[0],'BTN opens less than with no rake '+btn);
});

test('ring hands (view.rake) are judged with that rake chart; others with the no-rake chart',()=>{
 const data=loadGtoData();assert.ok(data.preflopRake[rakeKey(RING_RAKE)]);
 let h=startTrainerHand(77,3);const v=trainerView(h,h.round.toAct);
 const plain=gtoStrategy(v,data,0),raked=gtoStrategy({...v,rake:{...RING_RAKE}},data,0);
 assert.equal(plain.source,'preflop');assert.equal(raked.source,'preflop');
 assert.ok(plain.ev,'no-rake chart has EVs');assert.equal(raked.ev,undefined,'no EVs from the no-rake file on a raked chart');
});
