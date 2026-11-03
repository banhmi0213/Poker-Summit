const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
let seed=1;const shuffle=require('../lib/poker/server-shuffle.ts');shuffle.shuffleDeck=deck=>{const a=[...deck];for(let i=a.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const {SeatedHandRoom}=require('../lib/poker/seated-hand-room.ts'),{AuthoritativeHand}=require('../lib/poker/authoritative-hand.ts'),{ringTerms}=require('../lib/poker/tournament-hand.ts');
const order=Array.from({length:6},(_,i)=>'seat-'+(i+1));
function setup({ids=[1,2,3,4,5,6],stack=200,terms={...ringTerms,ante:100,anteType:'bb'},rng=1}={}){seed=rng;let now=1000;const room=new SeatedHandRoom(stack,terms,{tournament:true,now:()=>now}),tokens={};for(const n of ids){room.seat('m'+n,n);tokens[n]=room.connect('m'+n).connectionId;}room.startHand(ids.at(-1));return {room,tokens,setNow:n=>{now=n;},total:ids.length*stack};}
const command=(s,action,id)=>({handId:s.hand.handId,revision:s.hand.revision,actionId:id,action});
function act(f,action,id='a'){const s=f.room.publicSnapshot(),n=Number(s.hand.toAct.slice(5));return f.room.act('m'+n,f.tokens[n],command(s,action,id));}
function finish(f,allIn=true){for(let i=0;;i++){assert.ok(i<150);const s=f.room.publicSnapshot();if(s.hand.result)return s;const n=Number(s.hand.toAct.slice(5)),v=f.room.snapshot('m'+n,f.tokens[n]).hand,l=v.legal;
 const a=allIn&&l.raise?{type:s.hand.street==='preflop'||!l.check?'raise':'bet',amount:l.maxRaiseTo}:l.check?{type:'check'}:{type:'call'};act(f,a,'action-'+s.handNumber+'-'+i);}}
function two(){for(let n=1;n<=100;n++){const f=setup({rng:n}),s=finish(f);if(s.tournament.liveIds.length===2)return {f,s};}throw Error('No two-survivor fixture');}
const conserve=(s,total)=>assert.equal(s.hand.players.reduce((n,p)=>n+p.stack,0)+s.hand.pot,total);
test('next hand carries terminal chips and alternates heads-up without refill',()=>{
 const f=setup({ids:[1,6],stack:1000,terms:ringTerms}),before=f.room.publicSnapshot();act(f,{type:'fold'});const done=f.room.publicSnapshot(),stacks=done.tournament.stacks;assert.equal(done.phase,'complete');const next=f.room.nextHand(done.hand.handId);assert.notEqual(next.hand.handId,before.hand.handId);assert.equal(next.handNumber,2);assert.equal(next.hand.positions.bb,'seat-6');assert.equal(next.hand.positions.button,'seat-1');assert.equal(next.hand.positions.sb,'seat-1');assert.equal(next.hand.toAct,'seat-1');conserve(next,2000);for(const p of next.hand.players)assert.equal(p.stack+p.totalCommitted,stacks[p.id]);
});
test('only tournament mode may continue; live/unknown hand starts do not change state',()=>{
 const f=setup({ids:[1,6],stack:1000,terms:ringTerms}),s=f.room.publicSnapshot();assert.throws(()=>f.room.nextHand(s.hand.handId));assert.deepEqual(f.room.publicSnapshot(),s);const single=new SeatedHandRoom(1000,ringTerms);assert.throws(()=>single.nextHand('unknown'));assert.throws(()=>new SeatedHandRoom(1000,ringTerms,{tournament:'yes'}));
});
test('server hand accepts dead button/vacant SB and deals only to live physical seats',()=>{
 const positions={button:'seat-6',sb:null,bb:'seat-3',preflopFirst:'seat-4',postflopFirst:'seat-1'},entries=[1,3,4].map(n=>({id:'seat-'+n,stack:1000}));const h=new AuthoritativeHand(entries,0,ringTerms,{order,positions});const s=h.snapshot(null);assert.equal(s.positions.sb,null);assert.equal(s.pot,100);assert.deepEqual(s.players.map(p=>p.id),['seat-1','seat-3','seat-4']);assert.throws(()=>h.snapshot('seat-6'));assert.throws(()=>new AuthoritativeHand([...entries].reverse(),0,ringTerms,{order,positions}));for(let i=0;!h.snapshot(null).result;i++){assert.ok(i<50);const p=h.snapshot(null),v=h.snapshot(p.toAct);h.act(p.toAct,{handId:p.handId,revision:p.revision,actionId:'p'+i,action:v.legal.check?{type:'check'}:{type:'call'}});}assert.equal(h.snapshot(null).players.reduce((n,p)=>n+p.stack,0),3000);
});
test('transition to two survivors uses next live BB and opposite BTN/SB',()=>{
 const {f,s}=two(),prev=s.hand.positions.bb,next=f.room.nextHand(s.hand.handId),live=s.tournament.liveIds;
 const clockwise=[...order.slice(order.indexOf(prev)+1),...order.slice(0,order.indexOf(prev)+1)];assert.equal(next.hand.positions.bb,clockwise.find(id=>live.includes(id)));assert.notEqual(next.hand.positions.button,next.hand.positions.bb);assert.equal(next.hand.positions.sb,next.hand.positions.button);assert.equal(next.hand.toAct,next.hand.positions.button);assert.equal(next.hand.players.length,2);conserve(next,1200);
});
test('busted members reconnect as spectators with no next-hand cards/blinds/actions',()=>{
 const {f,s}=two(),busted=s.tournament.eliminated[0].id,n=Number(busted.slice(5));f.room.nextHand(s.hand.handId);const conn=f.room.connect('m'+n);const v=conn.state;assert.equal(v.youSeat,n);assert.ok(!v.hand.players.some(p=>p.id===busted));assert.ok(v.hand.players.every(p=>p.hole===null));assert.equal(v.hand.legal,null);assert.throws(()=>f.room.act('m'+n,conn.connectionId,command(v,{type:'call'},'busted')));assert.equal(v.tournament.stacks[busted],0);assert.throws(()=>f.room.seat('replacement',n));
});
test('zero live stack is not an elimination until terminal payouts are applied',()=>{
 const f=setup(),s=f.room.publicSnapshot();assert.ok(s.hand.players.some(p=>p.stack===0));assert.equal(s.tournament,null);assert.equal(s.phase,'playing');const done=finish(f);assert.ok(done.tournament);for(const p of done.hand.players)assert.equal(done.tournament.liveIds.includes(p.id),p.stack>0);conserve(done,1200);
});
test('invalid next-hand terms roll back; valid level changes apply only to the new hand',()=>{
 const f=setup({ids:[1,6],stack:1000,terms:ringTerms});act(f,{type:'fold'});const s=f.room.publicSnapshot();assert.throws(()=>f.room.nextHand(s.hand.handId,{...ringTerms,bb:NaN}));assert.deepEqual(f.room.publicSnapshot(),s);const next=f.room.nextHand(s.hand.handId,{...ringTerms,level:2,sb:100,bb:200,ante:200,anteType:'bb'});assert.equal(s.hand.terms.bb,100);assert.equal(next.hand.terms.bb,200);assert.equal(next.hand.terms.ante,200);conserve(next,2000);
});
test('repeated next commands, old actions and retired timers cannot affect the replacement hand',()=>{
 const f=setup({ids:[1,6],stack:1000,terms:ringTerms}),start=f.room.publicSnapshot(),n=Number(start.hand.toAct.slice(5)),payload=command(start,{type:'fold'},'old');f.room.act('m'+n,f.tokens[n],payload);const end=f.room.publicSnapshot(),next=f.room.nextHand(end.hand.handId);assert.throws(()=>f.room.nextHand(end.hand.handId));assert.throws(()=>f.room.nextHand(next.hand.handId));assert.throws(()=>f.room.act('m'+n,f.tokens[n],payload),/Wrong hand/);assert.equal(f.room.expireTurn(start.turn).expired,false);assert.deepEqual(f.room.publicSnapshot(),next);
});
test('elimination history is retained once and returned as independent copies',()=>{
 const {f,s}=two(),history=s.tournament.eliminated;const next=f.room.nextHand(s.hand.handId);assert.deepEqual(next.tournament.eliminated,history);next.tournament.eliminated[0].place=99;next.tournament.stacks[history[0].id]=9999;assert.deepEqual(f.room.publicSnapshot().tournament.eliminated,history);const end=finish(f);assert.equal(new Set(end.tournament.eliminated.map(e=>e.id)).size,end.tournament.eliminated.length);for(const e of history)assert.deepEqual(end.tournament.eliminated.find(x=>x.id===e.id),e);
});
test('survivors cannot leave/refill between hands; offline survivors still get blinds and deadlines',()=>{
 const f=setup({ids:[1,6],stack:1000,terms:ringTerms});act(f,{type:'fold'});const s=f.room.publicSnapshot();assert.throws(()=>f.room.leave('m1',f.tokens[1]),/reserved/);f.room.disconnect('m1',f.tokens[1]);const next=f.room.nextHand(s.hand.handId);assert.equal(next.seats[0].connected,false);assert.equal(next.hand.positions.sb,'seat-1');assert.equal(next.hand.toAct,'seat-1');f.setNow(next.turn.expiresAt);assert.equal(f.room.expireTurn(next.turn).action,'fold');assert.ok(f.room.publicSnapshot().hand.result);
});
test('champion ends the tournament and permanently prevents new deals/re-entry',()=>{
 const f=setup({rng:11});let s=finish(f);for(let i=0;!s.tournament.champion;i++){assert.ok(i<30);f.room.nextHand(s.hand.handId);s=finish(f);}assert.equal(s.phase,'finished');assert.equal(s.turn,null);assert.equal(s.tournament.stacks[s.tournament.champion],1200);assert.equal(s.tournament.eliminated.length,5);assert.throws(()=>f.room.nextHand(s.hand.handId),/finished/);assert.throws(()=>f.room.startHand(6));assert.throws(()=>f.room.seat('new',1));assert.deepEqual(f.room.publicSnapshot(),s);
});
test('20 complete six-player server tournaments conserve every chip through elimination and heads-up',()=>{
 for(let n=1;n<=20;n++){const f=setup({rng:n}),seen=new Set();let s=f.room.publicSnapshot();for(let hand=0;;hand++){assert.ok(hand<40);s=finish(f);conserve(s,1200);for(const e of s.tournament.eliminated)seen.add(e.id);assert.equal(seen.size,s.tournament.eliminated.length);if(s.tournament.champion)break;const old=s,live=old.tournament.liveIds;s=f.room.nextHand(old.hand.handId);assert.deepEqual(s.hand.players.map(p=>p.id),order.filter(id=>live.includes(id)));assert.ok(s.hand.players.every(p=>!seen.has(p.id)));assert.ok(s.hand.players.every(p=>p.hole===null));conserve(s,1200);if(live.length===2)assert.equal(s.hand.positions.sb,s.hand.positions.button);}
 assert.equal(s.phase,'finished');assert.equal(s.tournament.liveIds.length,1);assert.equal(seen.size,5);}
});
