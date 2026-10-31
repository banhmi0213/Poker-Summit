const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {handEquity,potOdds,madeIndex,MADE_NAMES}=require('../lib/poker/hand-equity.ts');
const {evalCodes}=require('../lib/poker/fast-eval.ts');
const c=s=>'23456789TJQKA'.indexOf(s[0])*4+'cdhs'.indexOf(s[1]);
const h=s=>s.split(' ').map(c);

test('AKs vs QQ preflop is about 46 / 54',()=>{
 const r=handEquity([h('As Ks'),h('Qh Qd')],[]);
 assert.equal(r.exact,false);
 assert.ok(Math.abs(r.hands[0].equity-0.46)<0.01,String(r.hands[0].equity));
 assert.ok(Math.abs(r.hands[0].equity+r.hands[1].equity-1)<1e-9);
 // same input, same numbers
 assert.equal(handEquity([h('As Ks'),h('Qh Qd')],[]).hands[0].win,r.hands[0].win);
});
test('river is exact: the better hand wins every time',()=>{
 const r=handEquity([h('Ah Kh'),h('Qc Qd')],h('Qh Jh Th 2c 3d'));
 assert.equal(r.exact,true);assert.equal(r.samples,1);
 assert.equal(r.hands[0].win,1);assert.equal(r.hands[0].made[0],1);
 assert.equal(r.hands[1].made[MADE_NAMES.indexOf('スリーカード')],1);
});
test('flop is exact over all 990 runouts; a chop is shared',()=>{
 const r=handEquity([h('Ah Kd'),h('Ac Ks')],h('2c 7d 9h'));
 assert.equal(r.exact,true);assert.equal(r.samples,990);
 assert.ok(r.hands[0].tie>0.9);
 assert.ok(Math.abs(r.hands[0].equity+r.hands[1].equity-1)<1e-9);
 for(const x of r.hands)assert.ok(Math.abs(x.made.reduce((a,b)=>a+b,0)-1)<1e-9);
});
test('three hands share the pot',()=>{
 const r=handEquity([h('As Ad'),h('Kh Kd'),h('7c 6c')],[]);
 assert.ok(Math.abs(r.hands.reduce((s,x)=>s+x.equity,0)-1)<1e-9);
 assert.ok(r.hands[0].equity>0.6);
});
test('duplicate cards are refused',()=>{assert.throws(()=>handEquity([h('As Ks'),h('As Qd')],[]));});
test('made-hand classes',()=>{
 assert.equal(MADE_NAMES[madeIndex(evalCodes(h('Ts Js Qs Ks As 2c 3d')))],'ロイヤルフラッシュ');
 assert.equal(MADE_NAMES[madeIndex(evalCodes(h('9s Ts Js Qs Ks 2c 3d')))],'ストレートフラッシュ');
 assert.equal(MADE_NAMES[madeIndex(evalCodes(h('2c 5d 9h Js Kd 3s 7c')))],'ハイカード');
});
test('pot odds: 50 into 100 needs 25%',()=>{
 const p=potOdds(100,50,50,0.462);
 assert.equal(p.final,200);assert.equal(p.required,0.25);
 assert.ok(Math.abs(p.ev-(0.462*200-50))<1e-9);
});
