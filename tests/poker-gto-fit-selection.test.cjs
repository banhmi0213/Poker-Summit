const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bbPass,bestRound}=require('../scripts/poker-gto/fit-selection.cjs');
const snapshot=(round,diff,defend)=>({play:{AA:round},role:{srp:{callBy:{BTN:round}}},report:{round,perHandDiff:diff,defend}});
const pass={BTN:.826,CO:.764,HJ:.686,UTG:.555};
test('selects minimum RFI only among BB-qualified rounds and keeps its own play/callBy',()=>{
 const good=snapshot(2,2.87,pass);
 const last=snapshot(6,1.41,{BTN:.772,CO:.730,HJ:.695,UTG:.559});
 assert.equal(bestRound([snapshot(0,3.09,pass),good,last]),good);
 assert.equal(bestRound([good,last]).play.AA,2);
 assert.equal(bestRound([good,last]).role.srp.callBy.BTN,2);
});
test('requires all four seats, includes exact +/-4pt boundary, excludes just outside',()=>{
 assert.equal(bbPass({defend:{BTN:.80,CO:.82,HJ:.66,UTG:.61}}),true);
 assert.equal(bbPass({defend:{...pass,BTN:.799}}),false);
 assert.equal(bbPass({defend:{BTN:.84}}),false);
 assert.equal(bestRound([snapshot(1,1,{BTN:.84})]),null);
 assert.equal(bestRound([snapshot(1,NaN,pass)]),null);
});
test('fit-stack saves each evaluated play/role before mutation and emits the eligible best round',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const root=path.resolve(__dirname,'..'),writes=new Map();let round=-1;
 const defenses=[{BTN:.84,CO:.78,HJ:.70,UTG:.57},pass,{BTN:.772,CO:.73,HJ:.695,UTG:.559}];
 const fakeSolver={
  playability:()=>1,setRealizeFit:()=>{},positionsFor:()=>['BTN','BB'],
  PreflopSolver:class {
   constructor(){round++;this.labels=['AA'];this.combos=[6];this.decisions=[{history:'',player:0,actions:[{kind:'fold'},{kind:'raise'}]},...Object.keys(pass).map(seat=>({history:seat+'2',player:1,seat,actions:[{kind:'fold'},{kind:'call'}]}))];}
   run(){} strategy(d){return d.player===0?[.8-round*.1,.2+round*.1]:[1-defenses[round][d.seat],defenses[round][d.seat]];}
  }
 };
 const fakeFs={...fs,readFileSync:(p,enc)=>String(p).endsWith('preflop-equity.json')?JSON.stringify({labels:['AA']}):fs.readFileSync(path.resolve(root,p),enc),mkdirSync:()=>{},writeFileSync:(p,value)=>writes.set(p,JSON.parse(value))};
 vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/poker-gto/fit-stack.cjs'),'utf8'),{
  __dirname:path.join(root,'scripts/poker-gto'),console:{log(){}},
  process:{argv:['node','fit-stack','--stack','40','--rounds','2','--iters','1','--out','out/check.json'],chdir(){}},
  require:name=>name==='fs'?fakeFs:name==='path'?path:name==='./fit-selection.cjs'?{bestRound}:name==='./common.cjs'?{}:fakeSolver
 });
 const rounds=writes.get('out/check.json.rounds.json').rounds;
 assert.equal(rounds.length,3);
 assert.notEqual(rounds[0].play.AA,rounds[1].play.AA);
 assert.deepEqual(JSON.parse(JSON.stringify(writes.get('out/check.json').play)),JSON.parse(JSON.stringify(bestRound(rounds).play)));
 assert.deepEqual(JSON.parse(JSON.stringify(writes.get('out/check.json').role)),JSON.parse(JSON.stringify(bestRound(rounds).role)));
 assert.equal(writes.get('out/check.json').selection.complete,true);
 assert.notEqual(writes.get('out/check.json').selection.selectedRound,2);
});
