const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {BotTable}=require('../lib/poker/bot-hands.ts');
const {ringTerms}=require('../lib/poker/tournament-hand.ts');
const {loadGtoData}=require('../lib/poker/gto-data-node.ts');
const {reviewGto,gtoVerdict,viewAt,summarizeDeviation,reviewRanges,flagHand}=require('../lib/poker/gto-review.ts');
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

test('each reviewed decision carries the whole range: 169-class grid, shares sum to 1, viewer\'s class marked',()=>{
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));
 const t=new BotTable(1,ringTerms,data,6,100),seen={preflop:0,flop:0,solver:0};
 for(let i=0;i<Number(process.env.GTO_REVIEW_HANDS||10);i++){const r=t.play(seeded(300+i));const h=r.history;if(!h)continue;
  for(const p of h.players){const view=asViewer(h,p.seatId);
   for(const rv of reviewGto(view,data,300)){if(rv.source==='none'||!rv.range)continue;seen[rv.source]++;
    const g=rv.range.grid,cls=Object.keys(g);assert.ok(cls.length>5&&cls.length<=169,`${rv.source} grid has classes`);
    assert.equal(rv.range.options.length,rv.options.length);
    for(const c of cls){const e=g[c];assert.ok(e.reach>=0&&e.reach<=1+1e-9);if(e.reach>0.01){const s=e.freqs.reduce((a,b)=>a+b,0);assert.ok(Math.abs(s-1)<0.02,`${rv.source} ${c} shares sum ${s}`);}}
    assert.ok(/^[AKQJT2-9]{2}[so]?$/.test(rv.range.hero));
    if(rv.source==='preflop'&&g[rv.range.hero])assert.ok(g[rv.range.hero].reach>0,'the viewer reached this spot with their class');
   }}
 }
 console.log('ranges by source',JSON.stringify(seen));assert.ok(seen.preflop>0);assert.ok(seen.flop+seen.solver>0);
});

test('deviation summary counts only preflop and flop, and a GTO CPU is almost never off',()=>{
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));
 const t=new BotTable(1,ringTerms,data,6,100),hands=[];
 for(let i=0;i<Number(process.env.GTO_REVIEW_HANDS||10)*2;i++){const r=t.play(seeded(500+i));if(r.history)hands.push(r.history);}
 const seat=hands[0].players[0].seatId,mine=hands.filter(h=>h.players.some(p=>p.seatId===seat)).map(h=>asViewer(h,seat));
 const t0=Date.now(),s=summarizeDeviation(mine,data);
 console.log('deviation',JSON.stringify({hands:s.hands,preflop:s.preflop,flop:s.flop,ms:Date.now()-t0}));
 assert.ok(s.preflop.judged>0);
 for(const st of [s.preflop,s.flop])assert.equal(st.gto+st.mixed+st.rare,st.judged);
 assert.ok(s.preflop.rare/s.preflop.judged<0.1,'GTO CPU rarely plays a ほぼやらない preflop action');
 assert.ok(s.worst.length<=8);assert.ok(s.worst.every((w,i,a)=>i===0||a[i-1].freq<=w.freq));
});

test('per-hand GTO flags agree with the summary and include turn and river when asked',()=>{
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));
 const t=new BotTable(1,ringTerms,data,6,100),hands=[];
 for(let i=0;i<16;i++){const r=t.play(seeded(500+i));if(r.history)hands.push(r.history);}
 const seat=hands[0].players[0].seatId,mine=hands.filter(h=>h.players.some(p=>p.seatId===seat)).map(h=>asViewer(h,seat));
 const s=summarizeDeviation(mine,data),fs=mine.map(h=>flagHand(h,data));
 assert.equal(fs.reduce((n,f)=>n+f.pre.judged,0),s.preflop.judged);
 assert.equal(fs.reduce((n,f)=>n+f.pre.off,0),s.preflop.rare);
 assert.equal(fs.reduce((n,f)=>n+f.post.judged,0),s.flop.judged);
 for(const f of fs){assert.equal(f.offs.length,f.pre.off+f.post.off);assert.ok(f.offs.every(o=>o.freq<0.05));}
 const late=mine.find(h=>h.actions.some(a=>a.seatId===seat&&(a.street==='turn'||a.street==='river')&&!['sb','bb','ante'].includes(a.type)));
 if(late){const f=flagHand(late,data,['turn','river'],300);assert.equal(f.pre.judged,0);assert.ok(f.post.judged>=0);}
});

test('hand categories on the board',()=>{
 const {handCategory,combosOfClass}=require('../lib/poker/hand-category.ts');
 const R='23456789TJQKA',c=s=>(R.indexOf(s[0]))*4+'cdhs'.indexOf(s[1]),h=(a,b)=>[c(a),c(b)],bd=s=>s.match(/../g).map(c);
 const cases=[['As','Ks','8h4s4d','ノーペア'],['Ah','Kh','8h4h2c','フラッシュドロー'],['9c','8d','7h6s2d','両面ストレートドロー'],['9c','5d','8h7s2d','ガットショット'],['Ac','2d','3h4s9d','ガットショット'],['8c','8d','8h4s4d','フルハウス以上'],['Kc','Kd','8h4s2d','オーバーペア'],['8c','Ad','8h4s2d','トップペア'],
  ['4c','Ad','8h4s2d','ミドルペア'],['2c','Ad','8h4s2d','ロウペア'],['5c','5d','8h4s2d','ミドルペア'],['3c','3d','8h4s2d','ロウペア'],['8c','4d','8h4s2d','ツーペア'],['4c','4d','8h4s2d','セット・スリーカード'],
  ['5c','6d','8h4s7d','ストレート'],['Ah','2h','8h4h7h','フラッシュ'],['7c','7d','7h7s2d','フルハウス以上'],['Ac','Kd','QhJs2d','ガットショット'],['9c','9d','QhJsTd','ロウペア'],['9c','8d','QhJs2d','ガットショット'],['Tc','9d','QhJs2d','両面ストレートドロー']];
 for(const [a,b,board,want] of cases)assert.equal(handCategory(h(a,b),bd(board)),want,`${a}${b} on ${board}`);
 assert.equal(combosOfClass('AKs',bd('AhKs2d')).length,2);assert.equal(combosOfClass('88',bd('8h4s2d')).length,3);assert.equal(combosOfClass('AKo',[]).length,12);
});

test('ranges at other players\' decisions use only the public record',()=>{
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));
 const t=new BotTable(1,ringTerms,data,6,100);let n=0,post=0;
 for(let i=0;i<Number(process.env.GTO_REVIEW_HANDS||10);i++){const r=t.play(seeded(700+i));const h=r.history;if(!h)continue;
  const seat=h.players[0].seatId,view=asViewer(h,seat),leaky={...view,players:h.players.map(p=>({seatId:p.seatId,seat:p.seat,startStack:p.startStack,you:p.seatId===seat,hole:p.hole}))};
  const a=reviewRanges(view,data,300),b=reviewRanges(leaky,data,300);
  assert.deepEqual(JSON.stringify(a.map(x=>[x.index,x.range.options])),JSON.stringify(b.map(x=>[x.index,x.range.options])),'opponents\' cards change nothing');
  for(const x of a){n++;if(x.range.board)post++;assert.notEqual(view.actions[x.index].seatId,seat);assert.equal(x.range.hero,'');assert.ok(Object.keys(x.range.grid).length>0);}
 }
 console.log('other ranges',n,'postflop',post);assert.ok(n>0);
});

test('heads-up hands use the heads-up chart: limps are judged, the button acts last after the flop',()=>{
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));assert.ok(data.preflopHu,'heads-up chart loaded');
 const c=(rank,suit)=>({rank,suit});
 const hand={handId:'hu1',terms:{bb:2},buttonSeatId:'s1',board:[c(14,'h'),c(7,'d'),c(2,'c'),c(9,'s'),c(4,'h')],
  players:[{seatId:'s1',seat:1,startStack:200,you:true,hole:[c(13,'s'),c(9,'h')]},{seatId:'s2',seat:2,startStack:200,you:false,hole:null}],
  actions:[{street:'preflop',seatId:'s1',type:'sb',amount:1,to:1,allIn:false,pot:3},{street:'preflop',seatId:'s2',type:'bb',amount:2,to:2,allIn:false,pot:3},
   {street:'preflop',seatId:'s1',type:'call',amount:1,to:2,allIn:false,pot:4},{street:'preflop',seatId:'s2',type:'check',amount:0,to:2,allIn:false,pot:4},
   {street:'flop',seatId:'s2',type:'check',amount:0,to:0,allIn:false,pot:4},{street:'flop',seatId:'s1',type:'check',amount:0,to:0,allIn:false,pot:4},
   {street:'turn',seatId:'s2',type:'check',amount:0,to:0,allIn:false,pot:4},{street:'turn',seatId:'s1',type:'bet',amount:2,to:2,allIn:false,pot:6}]};
 const rs=reviewGto(hand,data,400);
 const pre=rs.find(r=>r.street==='preflop');assert.equal(pre.source,'preflop','the limp is on the heads-up chart');assert.ok(pre.options.some(o=>o.kind==='call'));assert.notEqual(pre.played,null);
 const turn=rs.find(r=>r.street==='turn');assert.equal(turn.source,'solver',`turn judged (${turn.reason??''})`);
 const others=reviewRanges(hand,data,300);assert.ok(others.some(o=>hand.actions[o.index].type==='check'&&hand.actions[o.index].street==='preflop'),'the BB check after the limp has a range');
});

test('6-max: folded to the small blind, a limp and the big blind\'s check are on the chart',()=>{
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));
 const c=(rank,suit)=>({rank,suit});
 const hand={handId:'bvb1',terms:{bb:2},buttonSeatId:'s1',board:[c(14,'h'),c(7,'d'),c(2,'c'),c(9,'s'),c(4,'h')],
  players:[{seatId:'s1',seat:1,startStack:200,you:false,hole:null},{seatId:'s2',seat:2,startStack:200,you:true,hole:[c(9,'h'),c(8,'h')]},{seatId:'s3',seat:3,startStack:200,you:false,hole:null}],
  actions:[{street:'preflop',seatId:'s2',type:'sb',amount:1,to:1,allIn:false,pot:3},{street:'preflop',seatId:'s3',type:'bb',amount:2,to:2,allIn:false,pot:3},
   {street:'preflop',seatId:'s1',type:'fold',amount:0,to:0,allIn:false,pot:3},{street:'preflop',seatId:'s2',type:'call',amount:1,to:2,allIn:false,pot:4},
   {street:'preflop',seatId:'s3',type:'check',amount:0,to:2,allIn:false,pot:4}]};
 const rs=reviewGto(hand,data,300);const pre=rs.find(r=>r.street==='preflop');
 assert.equal(pre.source,'preflop');assert.ok(pre.options.some(o=>o.kind==='call'),'limp is an option');assert.notEqual(pre.played,null);
 const bb=reviewRanges(hand,data,300).find(o=>o.index===4);assert.ok(bb,'the BB check has a range');assert.ok(bb.range.options.some(o=>o.kind==='check'));
});

test('6-max: a squeeze after an open and a call is on the chart, for the squeezer and the opener',()=>{
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));
 const c=(rank,suit)=>({rank,suit});
 const P=(id,seat,you,hole)=>({seatId:id,seat,startStack:200,you,hole});
 const A=(seatId,type,amount,to,pot)=>({street:'preflop',seatId,type,amount,to,allIn:false,pot});
 // Six seats: s1 button. Order clockwise s2 SB, s3 BB, s4 UTG, s5 HJ, s6 CO.
 const base={terms:{bb:2},buttonSeatId:'s1',board:[c(14,'h'),c(7,'d'),c(2,'c')],
  actions:[A('s2','sb',1,1,3),A('s3','bb',2,2,3),A('s4','fold',0,0,3),A('s5','fold',0,0,3),A('s6','raise',5,5,8),A('s1','call',5,5,13),A('s2','fold',0,1,13),A('s3','raise',22,24,35),A('s6','call',19,24,54),A('s1','fold',0,5,54)]};
 const sq={...base,handId:'sq1',players:[P('s1',1,false,null),P('s2',2,false,null),P('s3',3,true,[c(14,'s'),c(13,'s')]),P('s4',4,false,null),P('s5',5,false,null),P('s6',6,false,null)]};
 const pre=reviewGto(sq,data,300).find(r=>r.street==='preflop');assert.equal(pre.source,'preflop',`squeeze judged (${pre.reason??''})`);assert.ok(pre.options.some(o=>/スクイーズ|レイズ/.test(o.text)||o.kind==='raise'));
 const op={...base,handId:'sq2',players:[P('s1',1,false,null),P('s2',2,false,null),P('s3',3,false,null),P('s4',4,false,null),P('s5',5,false,null),P('s6',6,true,[c(12,'s'),c(12,'h')])]};
 const rs=reviewGto(op,data,300).filter(r=>r.street==='preflop');assert.equal(rs.length,2);assert.ok(rs.every(r=>r.source==='preflop'),'opener judged facing the squeeze');
});
