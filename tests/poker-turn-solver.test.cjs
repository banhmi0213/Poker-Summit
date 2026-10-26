const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {PostflopSolver}=require('../lib/poker/postflop-solver.ts');
const {evalCodes}=require('../lib/poker/fast-eval.ts');
const {describe}=require('../lib/poker/solver-view.ts');
const code=s=>('23456789TJQKA'.indexOf(s[0]))*4+'cdhs'.indexOf(s[1]);
const combos=(board,pred)=>{const out=[];for(let a=0;a<52;a++)for(let b=a+1;b<52;b++)if(!board.includes(a)&&!board.includes(b)&&pred(a>>2,b>>2,a,b))out.push({c1:a,c2:b,weight:1});return out;};
const board=['Ah','Td','7c','4s'].map(code);

test('turn with no betting = pot x equity over every river card (exact card removal and chance weighting)',()=>{
 const r0=combos(board,(x,y)=>x>=9&&y>=9),r1=combos(board,(x,y)=>x===y||x+y>=19);
 const s=new PostflopSolver({board,pot:10,stack:0,betSizes:[],raiseSizes:[],maxRaises:0,ranges:[r0,r1]});
 let num=0,den=0;
 for(const a of r0)for(const b of r1){const held=[a.c1,a.c2,b.c1,b.c2];if(new Set(held).size<4)continue;
  for(let c=0;c<52;c++){if(board.includes(c)||held.includes(c))continue;const x=evalCodes([a.c1,a.c2,...board,c]),y=evalCodes([b.c1,b.c2,...board,c]);num+=x>y?1:x===y?0.5:0;den++;}}
 const [v0,v1]=s.values();
 assert.ok(Math.abs(v0-10*num/den)<1e-9,`solver ${v0} vs brute ${10*num/den}`);
 assert.ok(Math.abs(v0+v1-10)<1e-9);
});

test('a turn spot converges and the view walks through the river card',()=>{
 const r0=combos(board,(x,y)=>x+y>=19),r1=combos(board,(x,y)=>x===y||x+y>=20);
 const s=new PostflopSolver({board,pot:10,stack:30,betSizes:[0.75],raiseSizes:[],maxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:0,ranges:[r0,r1]});
 s.run(10);const early=s.exploitability();s.run(70);const late=s.exploitability();
 assert.ok(late<early&&late<0.02,`exploitability ${early} -> ${late}`);
 const [v0,v1]=s.values();assert.ok(Math.abs(v0+v1-10)<1e-6,'constant sum');
 const root=describe(s,[]);assert.equal(root.kind,'act');assert.equal(root.street,'turn');
 const sum=Object.values(root.classes).map(e=>e.slice(1).reduce((a,b)=>a+b,0));assert.ok(sum.every(x=>Math.abs(x-1)<1e-6));
 const check=root.actions.findIndex(a=>a.kind==='check');
 const deal=describe(s,[check,0]);assert.equal(deal.kind,'chance');assert.equal(deal.cards.length,48);
 const river=describe(s,[check,0,code('Ks')]);assert.equal(river.kind,'act');assert.equal(river.street,'river');
 // Hands holding the river card drop out: KK has 6 combos on the turn, at most 3 after the K♠.
 assert.equal(root.classes.KK[0],6);assert.ok(river.player===0&&river.classes.KK[0]<=3+1e-9,'KK reach '+river.classes.KK?.[0]);
 assert.ok(river.trail.at(-1).includes('K♠'));
});
