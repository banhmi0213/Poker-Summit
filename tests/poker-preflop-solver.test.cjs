const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {PreflopSolver,buildPreflopTree,playability}=require('../lib/poker/preflop-solver.ts');
const equity=require('../data/poker-gto/preflop-equity.json');
test('preflop tree: every chip is accounted for and stacks never exceed 100BB',()=>{
 const {root,decisions}=buildPreflopTree();let terminals=0;
 (function walk(n){if(n.type==='terminal'){terminals++;assert.ok(n.invested.every(v=>v>=0&&v<=100));assert.ok(n.winner!==undefined||n.showdown||n.threeWay);return;}assert.equal(n.actions.length,n.children.length);n.children.forEach(walk);})(root);
 assert.ok(decisions.length>50&&terminals>decisions.length);
});
test('playability: suited connectors play better than offsuit gappers',()=>{assert.ok(playability('98s')>playability('98o'));assert.ok(playability('98o')>playability('94o'));});
test('a short solve gives valid strategies: AA always opens UTG, 72o never does',()=>{
 const s=new PreflopSolver(equity);s.run(20);const utg=s.decisions.find(d=>d.history==='');const st=s.strategy(utg,true),k=utg.actions.length;
 const at=l=>s.labels.indexOf(l);for(let h=0;h<s.n;h++){let sum=0;for(let a=0;a<k;a++)sum+=st[h*k+a];assert.ok(Math.abs(sum-1)<1e-9);}
 assert.ok(st[at('AA')*k+1]>0.99);assert.ok(st[at('72o')*k+1]<0.01);
});
test('tournament depths: 20BB opens 2BB or all in, big raises become all in; 100BB tree unchanged',()=>{
 const {buildPreflopTree}=require('../lib/poker/preflop-solver.ts');
 const deep=buildPreflopTree(),short=buildPreflopTree({stack:20,ante:1});
 assert.equal(deep.decisions.length,169);
 const utg=short.decisions.find(d=>d.history===''),labels=utg.actions.map(a=>a.label);
 assert.deepEqual(labels,['フォールド','オープン 2BB','オールイン']);
 for(const d of short.decisions)for(const a of d.actions)if(a.to!==undefined&&a.kind==='raise')assert.ok(a.to<20*0.45,`${d.history} ${a.label} stays under 45% of the stack`);
 const jamCall=short.decisions.find(d=>d.history==='UTGAI ');assert.deepEqual(jamCall.actions.map(a=>a.kind),['fold','call']);
});
