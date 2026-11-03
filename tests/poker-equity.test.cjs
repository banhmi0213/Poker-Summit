const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {estimateEquity,requiredEquity,judgeDecision}=require('../lib/poker/equity.ts');
const seeded=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const c=(rank,suit)=>({rank,suit});
test('preflop equities match well-known values vs one random hand',()=>{
 const aa=estimateEquity([c(14,'s'),c(14,'h')],[],1,6000,seeded(1)).equity;assert.ok(aa>0.83&&aa<0.88,'AA '+aa);
 const s72=estimateEquity([c(7,'s'),c(2,'h')],[],1,6000,seeded(2)).equity;assert.ok(s72>0.31&&s72<0.37,'72o '+s72);
 const aa3=estimateEquity([c(14,'s'),c(14,'h')],[],3,4000,seeded(3)).equity;assert.ok(aa3>0.60&&aa3<0.68,'AA vs 3 '+aa3);
});
test('completed boards are exact: a nut hand wins, a board-play chops',()=>{
 const royal=estimateEquity([c(14,'s'),c(13,'s')],[c(12,'s'),c(11,'s'),c(10,'s'),c(2,'d'),c(3,'h')],2,300,seeded(4));assert.equal(royal.equity,1);
 const chop=estimateEquity([c(2,'c'),c(3,'d')],[c(14,'s'),c(13,'s'),c(12,'s'),c(11,'s'),c(10,'s')],1,300,seeded(5));assert.equal(chop.tie,1);assert.equal(chop.equity,0.5);
});
test('invalid input is rejected',()=>{
 assert.throws(()=>estimateEquity([c(14,'s'),c(14,'s')],[],1));assert.throws(()=>estimateEquity([c(14,'s'),c(13,'s')],[c(2,'c')],1));assert.throws(()=>estimateEquity([c(14,'s'),c(13,'s')],[],0));
});
test('pot odds and decision flags',()=>{
 assert.equal(requiredEquity(50,100),1/3);assert.equal(requiredEquity(0,100),0);
 assert.equal(judgeDecision('fold',0.6,0.33),'fold-strong');assert.equal(judgeDecision('fold',0.35,0.33),'fold-ok');
 assert.equal(judgeDecision('call',0.2,0.33),'call-thin');assert.equal(judgeDecision('call',0.3,0.33),'call-ok');assert.equal(judgeDecision('check',0.9,0),null);
});
const {reviewDecisions}=require('../lib/poker/hand-review.ts');
test('review flags folding a strong hand and calling with too little equity, from viewer-visible data only',()=>{
 const P=(seatId,you,hole)=>({seatId,startStack:1000,you,hole});
 const fold={board:[],players:[P('seat-1',false,null),P('seat-2',true,[c(14,'s'),c(14,'h')])],actions:[
  {street:'preflop',seatId:'seat-1',type:'sb',amount:50,to:50,allIn:false,pot:150},{street:'preflop',seatId:'seat-2',type:'bb',amount:100,to:100,allIn:false,pot:150},
  {street:'preflop',seatId:'seat-1',type:'raise',amount:250,to:300,allIn:false,pot:400},{street:'preflop',seatId:'seat-2',type:'fold',amount:0,to:100,allIn:false,pot:400}]};
 const [r]=reviewDecisions(fold,{iterations:2000,random:seeded(7)});
 assert.equal(r.toCall,200);assert.equal(r.pot,400);assert.ok(Math.abs(r.required-1/3)<1e-9);assert.equal(r.note,'fold-strong');assert.equal(r.opponents,1);
 const board=[c(14,'d'),c(13,'d'),c(12,'c'),c(9,'h'),c(8,'s')];
 const call={board,players:[P('seat-1',false,null),P('seat-2',true,[c(7,'s'),c(2,'h')])],actions:[
  {street:'preflop',seatId:'seat-1',type:'sb',amount:50,to:50,allIn:false,pot:150},{street:'preflop',seatId:'seat-2',type:'bb',amount:100,to:100,allIn:false,pot:150},
  {street:'preflop',seatId:'seat-1',type:'call',amount:50,to:100,allIn:false,pot:200},{street:'preflop',seatId:'seat-2',type:'check',amount:0,to:100,allIn:false,pot:200},
  {street:'river',seatId:'seat-1',type:'bet',amount:200,to:200,allIn:false,pot:400},{street:'river',seatId:'seat-2',type:'call',amount:200,to:200,allIn:false,pot:600}]};
 const rs=reviewDecisions(call,{iterations:500,random:seeded(8)});
 assert.deepEqual(rs.map(x=>[x.street,x.action,x.toCall]),[['preflop','check',0],['river','call',200]]);
 assert.equal(rs[1].note,'call-thin');assert.equal(rs[0].note,null);
 assert.deepEqual(reviewDecisions({...call,players:call.players.map(p=>({...p,hole:null}))}),[]);
});
