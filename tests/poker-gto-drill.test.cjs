const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {loadGtoData}=require('../lib/poker/gto-data-node.ts');
const {HERO,MODE_POSITIONS,reachSpot,startTrainerHand,trainerView}=require('../lib/poker/gto-trainer.ts');
const {decideGto}=require('../lib/poker/gto-bot.ts');
const {trainerSpot}=require('../lib/poker/gto-review.ts');

test('preflop drill spots: the hero acts first time in the chosen spot, with a chart menu and EVs',()=>{
 const data=loadGtoData();const decide=(h,id)=>decideGto(trainerView(h,id),data,Math.random,0).action;
 for(const mode of ['rfi','vsOpen','vs3bet']){let found=0;
  for(let b=0;b<6;b++){if(!MODE_POSITIONS[mode].includes(startTrainerHand(1,b).heroPos))continue;
   let h=null;for(let k=0;k<30&&!h;k++)h=reachSpot(3000+b*50+k,b,mode,decide);if(!h)continue;
   const s=trainerSpot(trainerView(h,HERO),data,0);assert.equal(s.source,'preflop');assert.ok(s.options.length>=2);
   assert.ok(s.options.every(o=>typeof o.ev==='number'),'EV for every option');found++;}
  assert.ok(found>=3,mode+' '+found);}
});
