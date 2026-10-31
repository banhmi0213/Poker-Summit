const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {loadGtoData}=require('../lib/poker/gto-data-node.ts');
const {HERO,reachSpot,startTrainerHand,trainerView}=require('../lib/poker/gto-trainer.ts');
const {decideGto}=require('../lib/poker/gto-bot.ts');
const {trainerSpot,liveRecordRows}=require('../lib/poker/gto-review.ts');
const {recordRow,spotOf,spotLabel,handClass,RECORD_SOURCES}=require('../lib/poker/gto-record.ts');

// The same checks as the database (supabase/migrations/*_poker_gto_records.sql), so rows are never dropped there.
const valid=r=>RECORD_SOURCES.includes(r.source)&&r.seats>=2&&r.seats<=10&&r.stack>=0&&r.position.length>=1&&r.position.length<=8
 &&['preflop','flop','turn','river'].includes(r.street)&&/^[A-Za-z0-9:+_-]{3,60}$/.test(r.spot)&&/^[2-9TJQKA]{2}[so]?$|^$/.test(r.hand)
 &&/^([2-9TJQKA][cdhs]){0,5}$/.test(r.board)&&r.action.length>=1&&r.action.length<=40&&(r.freq===null||(r.freq>=0&&r.freq<=1))
 &&(r.evLoss===null||r.evLoss>=0)&&(r.ref===undefined||(r.ref.length>=1&&r.ref.length<=80));

test('hand class',()=>{
 assert.equal(handClass([{rank:14,suit:'s'},{rank:13,suit:'s'}]),'AKs');
 assert.equal(handClass([{rank:7,suit:'h'},{rank:13,suit:'d'}]),'K7o');
 assert.equal(handClass([{rank:9,suit:'h'},{rank:9,suit:'d'}]),'99');
});
test('trainer spots become valid rows with a spot in words',()=>{
 const data=loadGtoData(),decide=(h,id)=>decideGto(trainerView(h,id),data,Math.random,0).action;let n=0;
 for(const mode of ['rfi','vsOpen','vs3bet'])for(let b=0;b<6;b++){
  let h=null;for(let k=0;k<20&&!h;k++)h=reachSpot(5000+b*40+k,b,mode,decide);if(!h)continue;
  const v=trainerView(h,HERO),s=trainerSpot(v,data,0);if(s.source==='none')continue;
  const row=recordRow(v,'trainer',{freqs:s.options.map(o=>o.freq),chosen:0,action:s.options[0].text,evLoss:0.5});
  assert.ok(valid(row),JSON.stringify(row));
  assert.ok(row.spot.startsWith(mode==='rfi'?'pre:open:':mode==='vsOpen'?'pre:vsOpen:':'pre:vs3bet:'),mode+' '+row.spot);
  assert.notEqual(spotLabel(row.spot),row.spot);n++;
 }
 assert.ok(n>=8,String(n));
});
test('practice-table decisions: rows with ref and step, nothing for spots without data',()=>{
 const data=loadGtoData(),h=startTrainerHand(11,3),v=trainerView(h,HERO);
 const played={street:'preflop',id:HERO,type:'fold',to:0,allIn:false,potBefore:1.5,currentBetBefore:1,committedBefore:0};
 const rows=liveRecordRows([{view:v,played}],data,'11111111-2222-3333-4444-555555555555',0);
 for(const r of rows){assert.ok(valid(r),JSON.stringify(r));assert.equal(r.source,'practice');assert.equal(r.step,0);}
});
test('postflop spot keys',()=>{
 const v={hero:'a',bb:1,board:[{rank:14,suit:'h'},{rank:7,suit:'d'},{rank:2,suit:'c'}],hole:[],positions:{a:'BB',b:'BTN'},
  players:[{id:'a',folded:false},{id:'b',folded:false}],log:[{street:'preflop',id:'b',type:'raise'},{street:'preflop',id:'a',type:'call'},{street:'flop',id:'a',type:'check'},{street:'flop',id:'b',type:'bet'}]};
 assert.equal(spotOf(v),'flop:srp:oop:facing');
 assert.equal(spotLabel('flop:srp:oop:facing'),'フロップ・シングルレイズのポット・先に打つ側（OOP）・ベットを受けたとき');
});
