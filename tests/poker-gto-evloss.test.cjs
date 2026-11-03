const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {evLoss,startTrainerHand,trainerAct,trainerView,HERO}=require('../lib/poker/gto-trainer.ts');
const {trainerSpot}=require('../lib/poker/gto-review.ts');
const {loadGtoData}=require('../lib/poker/gto-data-node.ts');
const chart=require('../public/poker-gto/preflop.json'),evFile=require('../public/poker-gto/preflop-ev.json');

test('evLoss: best minus chosen, null when any EV is missing',()=>{
 assert.equal(evLoss([{ev:1.5},{ev:-0.25}],1),1.75);
 assert.equal(evLoss([{ev:1.5},{ev:-0.25}],0),0);
 assert.equal(evLoss([{ev:1.5},{}],0),null);
 assert.equal(evLoss([],0),null);
});

test('preflop EV file matches the chart: same decisions, one EV per action, folding costs what was put in',()=>{
 assert.equal(evFile.nodes.length,chart.nodes.length);
 const byId=new Map(evFile.nodes.map(n=>[n.id,n]));
 for(const n of chart.nodes){const e=byId.get(n.id);assert.ok(e,'node '+n.id);assert.equal(e.history,n.history);
  for(const [l,row] of Object.entries(n.strategy))assert.equal(e.ev[l].length,row.length);}
 const open=chart.nodes.find(n=>n.kind==='open'&&n.player==='UTG'),ev=byId.get(open.id).ev;
 assert.equal(ev.AA[0],0);assert.ok(ev.AA[1]>3,'AA open is worth a lot');assert.ok(ev['72o'][1]<0,'72o open loses');
 const bb=chart.nodes.find(n=>n.kind==='vsOpen'&&n.player==='BB'&&/BTN2\.5/.test(n.history));
 assert.equal(byId.get(bb.id).ev['72o'][0],-1,'BB folding loses the big blind');
});

test('trainer: preflop options carry EVs and the most played option loses (almost) nothing',()=>{
 const data=loadGtoData();assert.ok(data.preflopEv);let checked=0;
 for(let k=0;k<40;k++){const h=startTrainerHand(500+k,k%6);let x=h;
  while(!x.result&&x.round.toAct!==HERO){const id=x.round.toAct,v=trainerView(x,id),s=trainerSpot(v,data,0);
   if(s.source==='none')break;const top=s.options.reduce((b,o,i)=>o.freq>s.options[b].freq?i:b,0);
   const {toTable}=require('../lib/poker/gto-bot.ts');x=trainerAct(x,id,toTable(v,s.options[top].kind,s.options[top].label,s.options[top].to));}
  if(x.result||x.round.toAct!==HERO)continue;
  const s=trainerSpot(trainerView(x,HERO),data,0);if(s.source!=='preflop'||!s.options.every(o=>typeof o.ev==='number'))continue;
  const top=s.options.reduce((b,o,i)=>o.freq>s.options[b].freq?i:b,0);
  if(s.options[top].freq<0.9)continue;checked++;
  assert.ok(evLoss(s.options,top)<=0.05,`top option loses ${evLoss(s.options,top)} at ${x.log.map(a=>a.id+a.type).join(' ')}`);
 }
 assert.ok(checked>=10,'checked '+checked);
});
