const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {AuthoritativeHand}=require('../lib/poker/authoritative-hand.ts');
const {parseRingCommand,parseRingLobbyState}=require('../lib/poker/ring-admission.ts');
const terms={level:0,index:0,sb:50,bb:100,ante:0,anteType:'none'};
let n=0;const act=(h,seat,action)=>{const s=h.snapshot(seat);return h.act(seat,{handId:s.handId,revision:s.revision,actionId:'r'+(++n),action});};
const key=c=>c.rank+c.suit;

test('rabbit: only the undealt board of a hand that ended early without showdown, never during play',()=>{
 const h=new AuthoritativeHand([{id:'seat-1',stack:10000},{id:'seat-2',stack:10000}],0,terms);
 assert.equal(h.rabbitBoard(),null,'no rabbit while the hand is running');
 const first=h.snapshot(null).toAct;act(h,first,{type:'call'});const second=h.snapshot(null).toAct;act(h,second,{type:'check'});
 // Flop is out (3 cards); the next player bets and the other folds.
 const bettor=h.snapshot(null).toAct;act(h,bettor,{type:'bet',amount:200});const folder=h.snapshot(null).toAct;act(h,folder,{type:'fold'});
 const end=h.snapshot(null);assert.ok(end.result&&!end.result.showdown);assert.equal(end.board.length,3);
 const rabbit=h.rabbitBoard();assert.equal(rabbit.length,2);
 const full=h.checkpoint().deal.board;assert.deepEqual(rabbit.map(key),full.slice(3).map(key));
 assert.ok(!end.board.map(key).some(c=>rabbit.map(key).includes(c)));
});
test('rabbit: a showdown hand has nothing to show',()=>{
 const h=new AuthoritativeHand([{id:'seat-1',stack:10000},{id:'seat-2',stack:10000}],0,terms);
 for(let g=0;g<20&&h.snapshot(null).toAct;g++){const s=h.snapshot(null).toAct,l=h.snapshot(s).legal;act(h,s,l.check?{type:'check'}:{type:'call'});}
 assert.ok(h.snapshot(null).result.showdown);assert.equal(h.rabbitBoard(),null);
});
test('rabbit command and reply are strictly parsed',()=>{
 const id='11111111-1111-4111-8111-111111111111';
 assert.deepEqual(parseRingCommand({type:'rabbit',reservationId:id,requestId:id,handId:id}),{type:'rabbit',reservationId:id,requestId:id,handId:id});
 assert.throws(()=>parseRingCommand({type:'rabbit',reservationId:id,requestId:id,handId:id,extra:1}));
 const base={wallet:{available:0,inPlay:0,total:0},membership:null,tables:[],table:null,play:null};
 assert.equal(parseRingLobbyState(base).rabbit,undefined);
 assert.deepEqual(parseRingLobbyState({...base,rabbit:{handId:id,cards:[{rank:13,suit:'s'},{rank:7,suit:'d'}]}}).rabbit.cards,[{rank:13,suit:'s'},{rank:7,suit:'d'}]);
 assert.throws(()=>parseRingLobbyState({...base,rabbit:{handId:id,cards:[{rank:1,suit:'s'}]}}));
});
