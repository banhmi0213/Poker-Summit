const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {exploreTurn,turnStart}=require('../lib/poker/gto-explore.ts');
test('turn and river from a flop line: pot from the bet tree, ranges narrowed by the flop, river cards to choose',()=>{
 const dir=path.join(__dirname,'..','public','poker-gto','flops','btn-bb'),name=fs.readdirSync(dir).find(f=>f.startsWith('K'));
 const file=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
 assert.deepEqual(turnStart(file,[0,0]),{pot:file.spot.pot,stack:file.spot.stack},'check-check keeps the pot');
 const bet=turnStart(file,[1,1]);assert.ok(bet.pot>file.spot.pot&&bet.stack<file.spot.stack,'bet and call grow the pot');
 assert.ok('error' in turnStart(file,[0]),'the flop is not over after one check');
 const free=[...Array(52).keys()].find(c=>!file.board.includes(c)),turn='23456789TJQKA'[free>>2]+'cdhs'[free&3];
 const r=exploreTurn(file,[0,0],turn,[],300);assert.equal(r.view.kind,'act');assert.equal(r.view.player,0);
 assert.ok(Math.abs(r.view.total.reduce((a,b)=>a+b,0)-1)<1e-6);
 const river=exploreTurn(file,[0,0],turn,[0,0],300);assert.equal(river.view.kind,'chance');assert.equal(river.view.cards.length,48);
 const after=exploreTurn(file,[0,0],turn,[0,0,river.view.cards[0]],300);assert.equal(after.view.street,'river');
 assert.ok('error' in exploreTurn(file,[0,0],name.slice(0,2),[],300),'a board card cannot be the turn');
});
