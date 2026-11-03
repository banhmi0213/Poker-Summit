const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {preflopQuestion,flopQuestion,gradeQuiz,explainQuiz}=require('../lib/poker/gto-quiz.ts');
const {preflopReach}=require('../lib/poker/gto-bot.ts');
const seeded=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const root=path.join(__dirname,'..','public','poker-gto'),preflop=JSON.parse(fs.readFileSync(path.join(root,'preflop.json'),'utf8'));
const index=JSON.parse(fs.readFileSync(path.join(root,'flops','index.json'),'utf8'));
const sum=xs=>xs.reduce((s,x)=>s+x,0);

test('preflop reach: first decisions are 1, a 3-bet decision only holds hands that opened',()=>{
 const open=preflop.nodes.find(n=>n.kind==='open'),r=preflopReach(preflop,open);assert.ok(Object.values(r).every(x=>x===1));
 const vs3=preflop.nodes.find(n=>n.kind==='vs3bet'&&n.player==='BTN'),r3=preflopReach(preflop,vs3);
 assert.ok(r3.AA>0.9,'AA opens');assert.ok(r3['72o']<0.01,'72o does not open');
});

test('preflop questions: valid cards, options, normalised frequencies, and the hero holds the hand in this spot',()=>{
 const rand=seeded(7),kinds={};
 for(let i=0;i<300;i++){const q=preflopQuestion(preflop,rand);assert.ok(q);assert.match(q.category,/^preflop-(open|vsopen|vs3bet|vs4bet|vs5bet|overcall|vslimp|vsiso|vssqueeze)$/);kinds[q.scene.split('、').length]=1;
  assert.equal(q.cards.length,2);assert.notEqual(q.cards[0],q.cards[1]);
  assert.equal(q.options.length,q.freqs.length);assert.equal(q.options.length,q.rangeFreqs.length);
  assert.ok(Math.abs(sum(q.freqs)-1)<1e-9);assert.ok(Math.abs(sum(q.rangeFreqs)-1)<1e-9);
  // Several nodes can share labels and an identical row (e.g. always fold); one of them must be the question's.
  const nodes=preflop.nodes.filter(n=>n.player===q.hero&&n.actions.map(a=>a.label).join()===q.options.join()&&q.freqs.every((f,k)=>Math.abs(f-n.strategy[q.handClass][k]/sum(n.strategy[q.handClass]))<1e-9));
  assert.ok(nodes.length,'question matches a chart node');assert.ok(nodes.some(node=>preflopReach(preflop,node)[q.handClass]>0.02),'hero reaches this node with the hand');
  for(let c=0;c<q.options.length;c++){const g=gradeQuiz(q,c),lines=explainQuiz(q,g);assert.ok(lines.length>=3);assert.ok(lines.every(l=>!/undefined|NaN/.test(l)),lines.join('\n'));}
 }
});

test('flop questions use computed files, avoid board cards and use suit-aware rows',()=>{
 const rand=seeded(11);let n=0;
 for(const [spot,list] of Object.entries(index))for(const flop of list.slice(0,4)){
  const file=JSON.parse(fs.readFileSync(path.join(root,'flops',spot,flop+'.json'),'utf8'));
  for(let i=0;i<10;i++){const q=flopQuestion(file,spot,'title','detail',rand);if(!q)continue;n++;assert.equal(q.category,'flop-'+spot);
   assert.ok(!q.board.includes(q.cards[0])&&!q.board.includes(q.cards[1]));assert.equal(q.board.length,3);
   assert.ok(Math.abs(sum(q.freqs)-1)<1e-9);assert.ok(q.made);
   for(let c=0;c<q.options.length;c++){const lines=explainQuiz(q,gradeQuiz(q,c));assert.ok(lines.every(l=>!/undefined|NaN/.test(l)),lines.join('\n'));}
  }}
 assert.ok(n>50,`flop questions made: ${n}`);
});

test('grading: best option 100 / 正解, a never-played option ミス',()=>{
 const q={options:['フォールド','コール','3ベット 11BB'],freqs:[0,0.3,0.7],rangeFreqs:[0.5,0.3,0.2],hero:'BB',handClass:'AQo',made:null};
 assert.deepEqual(gradeQuiz(q,2),{choice:2,freq:0.7,points:100,verdict:'正解'});
 assert.equal(gradeQuiz(q,1).verdict,'まずまず');assert.equal(gradeQuiz(q,0).verdict,'ミス');
 assert.match(explainQuiz(q,gradeQuiz(q,0)).join('\n'),/選ばない打ち方/);
});

test('practising one preflop category asks only that kind',()=>{
 const rand=seeded(3);for(let i=0;i<40;i++){const q=preflopQuestion(preflop,rand,'vs3bet');assert.equal(q.category,'preflop-vs3bet');}
});
