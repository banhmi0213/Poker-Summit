const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {loadGtoData}=require('../lib/poker/gto-data-node.ts');
const {HERO,evLoss,startTrainerHand,trainerAct,trainerView,TRAINER_BB}=require('../lib/poker/gto-trainer.ts');
const {decideGto}=require('../lib/poker/gto-bot.ts');
const {trainerSpot}=require('../lib/poker/gto-review.ts');

test('turn and river decisions carry EVs from converged solves; GTO\'s main choice loses little',()=>{
 const data=loadGtoData();let checked=0;
 for(let k=0;k<60&&checked<4;k++){
  let h=startTrainerHand(7000+k,k%6);
  for(let g=0;g<80&&!h.result;g++){
   const id=h.round.toAct;if(!id)break;const v=trainerView(h,id);
   if(id===HERO&&h.street>=2){
    const live=h.round.players.filter(p=>!p.folded).length;
    if(live===2){const s=trainerSpot(v,data,1500);
     // A turn solve that is not close enough to equilibrium gives no EVs at all (never some options only).
     if(s.source==='solver'&&!s.approx&&s.options.some(o=>typeof o.ev==='number')){
      assert.ok(s.options.every(o=>typeof o.ev==='number'),'EV on every option');
      const pot=h.round.players.reduce((t,p)=>t+p.totalCommitted,0)/TRAINER_BB;
      for(const o of s.options)assert.ok(Math.abs(o.ev)<=pot+200,'EV within reach of the pot '+o.ev);
      const top=s.options.reduce((b,o,i)=>o.freq>s.options[b].freq?i:b,0);
      if(s.options[top].freq>=0.9)assert.ok(evLoss(s.options,top)<=Math.max(0.5,pot*0.05),'main choice loss '+evLoss(s.options,top)+' pot '+pot);
      checked++;}}
   }
   h=trainerAct(h,id,decideGto(v,data,Math.random,300).action);
  }
 }
 assert.ok(checked>=2,'checked '+checked);
});
