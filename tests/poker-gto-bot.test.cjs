const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {BotTable}=require('../lib/poker/bot-hands.ts');
const {ringTerms}=require('../lib/poker/tournament-hand.ts');
const {loadGtoData}=require('../lib/poker/gto-data-node.ts');
const {decideGto}=require('../lib/poker/gto-bot.ts');
const seeded=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};

test('GTO CPUs play complete hands from the chart, flop solutions and the turn/river solver without anomalies',()=>{
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));assert.ok(data,'GTO data loads');
 const t=new BotTable(1,ringTerms,data,6,60),all={};let shown=0;const N=Number(process.env.GTO_HANDS||12);
 for(let i=0;i<N;i++){const r=t.play(seeded(i+1));assert.deepEqual(r.anomalies.map(a=>a.kind+': '+a.detail),[]);for(const [k,n] of Object.entries(r.sources))all[k]=(all[k]??0)+n;if(r.history.players.some(p=>p.shown))shown++;}
 console.log('decisions by source',JSON.stringify(all),'showdowns',shown);
 assert.ok(all.preflop>0,'preflop chart used');assert.ok((all.solver??0)+(all.flop??0)>0,'postflop GTO used');
});
test('UTG opens only chart hands: 72o folds, AA raises to 2.5BB',()=>{
 const data=loadGtoData(path.join(__dirname,'..','public','poker-gto'));
 const positions={a:'UTG',b:'HJ',c:'CO',d:'BTN',e:'SB',f:'BB'},players=Object.keys(positions).map(id=>({id,stack:id==='e'?9950:id==='f'?9900:10000,committed:id==='e'?50:id==='f'?100:0,totalCommitted:id==='e'?50:id==='f'?100:0,folded:false,allIn:false}));
 const view=hole=>({handKey:'h',bb:100,hero:'a',hole,board:[],positions,players,legal:{check:false,call:true,callAmount:100,raise:true,minRaiseTo:200,maxRaiseTo:10000},log:[],startStacks:Object.fromEntries(Object.keys(positions).map(id=>[id,10000]))});
 const fold=decideGto(view([{rank:7,suit:'h'},{rank:2,suit:'c'}]),data,()=>0.5);assert.equal(fold.action.type,'fold');assert.equal(fold.source,'preflop');
 const raise=decideGto(view([{rank:14,suit:'h'},{rank:14,suit:'c'}]),data,()=>0.5);assert.deepEqual(raise.action,{type:'raise',amount:250});
});
