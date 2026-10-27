const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {BotTable}=require('../lib/poker/bot-hands.ts');
const {ringTerms}=require('../lib/poker/tournament-hand.ts');
const {loadGtoData}=require('../lib/poker/gto-data-node.ts');
const {reviewGto,gtoVerdict,viewAt}=require('../lib/poker/gto-review.ts');
const seeded=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const asViewer=(h,seatId)=>({handId:h.handId,terms:h.terms,buttonSeatId:h.buttonSeatId,board:h.board,actions:h.actions,players:h.players.map(p=>({seatId:p.seatId,seat:p.seat,startStack:p.startStack,you:p.seatId===seatId,hole:p.seatId===seatId?p.hole:null}))});

test('verdict bands',()=>{assert.equal(gtoVerdict(0.6),'gto');assert.equal(gtoVerdict(0.3),'gto');assert.equal(gtoVerdict(0.1),'mixed');assert.equal(gtoVerdict(0.04),'rare');assert.equal(gtoVerdict(0),'rare');});

test('a GTO CPU\'s own preflop and flop actions are never judged ほぼやらない-at-zero, and the review sees only the viewer\'s cards',()=>{
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));assert.ok(data);
 const t=new BotTable(1,ringTerms,data,6,100),counts={preflop:0,flop:0,solver:0,none:0};
 for(let i=0;i<Number(process.env.GTO_REVIEW_HANDS||10);i++){const r=t.play(seeded(100+i));const h=r.history;if(!h)continue;
  for(const p of h.players){const view=asViewer(h,p.seatId);
   // No opponent hole cards are present in what the review is given.
   assert.ok(view.players.filter(x=>!x.you).every(x=>x.hole===null));
   for(const rv of reviewGto(view,data,300)){counts[rv.source]++;
    if(rv.source==='preflop'||rv.source==='flop'){assert.notEqual(rv.played,null,`${rv.source} action maps onto an option`);assert.ok(rv.played>0,`${rv.source} action has positive frequency`);
     assert.ok(Math.abs(rv.options.reduce((s,o)=>s+o.freq,0)-1)<1e-6);}
   }}
 }
 console.log('reviews by source',JSON.stringify(counts));assert.ok(counts.preflop>0);
});

test('decision point is rebuilt from the public record',()=>{
 const c=(rank,suit)=>({rank,suit});
 const hand={handId:'h1',terms:{bb:2},buttonSeatId:'seat-1',board:[c(2,'c'),c(7,'d'),c(9,'h'),c(11,'s'),c(13,'c')],
  players:[{seatId:'seat-1',seat:1,startStack:200,you:true,hole:[c(14,'s'),c(14,'h')]},{seatId:'seat-2',seat:2,startStack:200,you:false,hole:null},{seatId:'seat-3',seat:3,startStack:200,you:false,hole:null}],
  actions:[{street:'preflop',seatId:'seat-2',type:'sb',amount:1,to:1,allIn:false,pot:3},{street:'preflop',seatId:'seat-3',type:'bb',amount:2,to:2,allIn:false,pot:3},
   {street:'preflop',seatId:'seat-1',type:'raise',amount:5,to:5,allIn:false,pot:8},{street:'preflop',seatId:'seat-2',type:'fold',amount:0,to:1,allIn:false,pot:8},
   {street:'preflop',seatId:'seat-3',type:'call',amount:3,to:5,allIn:false,pot:11},{street:'flop',seatId:'seat-3',type:'check',amount:0,to:0,allIn:false,pot:11},
   {street:'flop',seatId:'seat-1',type:'bet',amount:4,to:4,allIn:false,pot:15}]};
 const v=viewAt(hand,6);
 assert.deepEqual(v.positions,{'seat-1':'BTN','seat-2':'SB','seat-3':'BB'});assert.equal(v.board.length,3);
 assert.deepEqual(v.log.map(a=>[a.type,a.potBefore,a.to]),[['raise',3,5],['fold',8,1],['call',8,5],['check',11,0]]);
 const me=v.players.find(p=>p.id==='seat-1');assert.equal(me.stack,195);assert.equal(me.committed,0);assert.equal(v.players.find(p=>p.id==='seat-2').folded,true);
 assert.equal(v.legal.check,true);
});

test('practice-table GTO hint: advice for a live decision is sorted and sums to 1',()=>{
 const {adviseGto}=require('../lib/poker/gto-review.ts');
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));const t=new BotTable(3,ringTerms,data,6,100);let checked=0;
 for(let i=0;i<4&&checked<10;i++){const h=t.play(seeded(300+i)).history;if(!h)continue;
  for(const p of h.players){const view=asViewer(h,p.seatId);
   view.actions.forEach((a,k)=>{if(a.seatId!==p.seatId||['ante','sb','bb'].includes(a.type)||a.street!=='preflop')return;const v=viewAt(view,k);if(!v)return;
    const adv=adviseGto(v,data,300);if(adv.source==='none')return;checked++;
    assert.ok(Math.abs(adv.options.reduce((s,o)=>s+o.freq,0)-1)<0.02);
    for(let j=1;j<adv.options.length;j++)assert.ok(adv.options[j-1].freq>=adv.options[j].freq);
    assert.ok(adv.options.every(o=>!/undefined|NaN/.test(o.text)));});
  }}
 assert.ok(checked>0);
});

test('practice table: decisions captured live are reviewed like the hand history review',()=>{
 const {reviewLive}=require('../lib/poker/gto-review.ts');
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));const t=new BotTable(5,ringTerms,data,6,100);let n=0;
 for(let i=0;i<3;i++){const h=t.play(seeded(500+i)).history;if(!h)continue;const p=h.players[0],view=asViewer(h,p.seatId),items=[];
  view.actions.forEach((a,k)=>{if(a.seatId!==p.seatId||['ante','sb','bb'].includes(a.type))return;const v=viewAt(view,k);if(!v)return;
   items.push({view:v,played:{street:a.street,id:a.seatId,type:a.type,to:a.to,allIn:a.allIn,potBefore:k>0?view.actions[k-1].pot:0,currentBetBefore:Math.max(0,...v.players.map(x=>x.committed)),committedBefore:v.players.find(x=>x.id===a.seatId).committed}});});
  const old=reviewGto(view,data,300),live=reviewLive(items,data,300);assert.equal(live.length,old.length);
  live.forEach((r,j)=>{n++;assert.equal(r.source==='none'?'none':'model',old[j].source==='none'?'none':'model');assert.ok(!/undefined|NaN/.test(r.played));
   if(r.source!=='none'&&old[j].source!=='none'&&r.source!=='solver'){assert.equal(r.verdict,old[j].verdict);}});
 }
 assert.ok(n>0);
});
