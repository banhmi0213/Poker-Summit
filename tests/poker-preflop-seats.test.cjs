const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {buildPreflopTree,positionsFor}=require('../lib/poker/preflop-solver.ts');

test('6 seats: the tree the published chart was solved with',()=>{
 const t=buildPreflopTree({stack:100,ante:0});
 assert.equal(t.decisions.length,169);
 const chart=require('../public/poker-gto/preflop.json');
 assert.deepEqual(t.decisions.map(d=>d.history.trim()),chart.nodes.map(n=>n.history));
});
for(const seats of [8,9])test(`${seats} seats: every seat but the big blind can open, blinds post 0.5 / 1`,()=>{
 const names=positionsFor(seats),t=buildPreflopTree({stack:100,ante:0,seats});
 assert.equal(names.length,seats);assert.equal(names[seats-2],'SB');assert.equal(names[seats-1],'BB');
 const opens=t.decisions.filter(d=>d.history.split(' ').filter(Boolean).every(x=>x.endsWith('F')));
 assert.deepEqual(opens.map(d=>d.player).sort((a,b)=>a-b),Array.from({length:seats-1},(_,i)=>i));
 const root=t.decisions.find(d=>d.history==='');assert.equal(root.player,0);
 const fold=n=>n.type==='decision'?fold(n.children[0]):n;
 const end=fold(root);assert.equal(end.winner,seats-1);assert.equal(end.invested[seats-2],0.5);assert.equal(end.invested[seats-1],1);
 // the squeeze and 3-bet sizes from the blinds follow the blinds, wherever they sit
 const bbVsOpen=t.decisions.find(d=>d.player===seats-1&&/^UTG2\.5( \S+F)+$/.test(d.history.trim()));
 assert.equal(bbVsOpen.actions[2].to,11);
});
