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
test('three-way pots: flop answers come from the three-way file, the turn from a live three-way solve, and a flop fold hands over to heads-up',()=>{
 const {gtoStrategy}=require('../lib/poker/gto-bot.ts');
 const base=loadGtoData(path.join(__dirname,'..','public','poker-gto')),mw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','poker-gto-mw-co-btn-bb-Kh7d2c.json'),'utf8'));
 const data={...base,flopIndex:{...base.flopIndex,'co-btn-bb':['Kh7d2c']},flop:(s,f)=>s==='co-btn-bb'&&f==='Kh7d2c'?mw:base.flop(s,f)};
 const C=s=>({rank:'23456789TJQKA'.indexOf(s[0])+2,suit:s[1]}),positions={u:'UTG',h:'HJ',c:'CO',b:'BTN',s:'SB',g:'BB'};
 const L=(street,id,type,to,potBefore,cb=0)=>({street,id,type,to,allIn:false,potBefore,currentBetBefore:cb,committedBefore:0});
 const view=(hero,hole,board,acts,folded=[])=>{const committed={u:0,h:0,c:250,b:250,s:50,g:250};
  const log=[L('preflop','u','fold',0,150,100),L('preflop','h','fold',0,150,100),L('preflop','c','raise',250,150,100),L('preflop','b','call',250,400,250),L('preflop','s','fold',0,650,250),L('preflop','g','call',250,650,250),...acts];
  return {handKey:'mw-'+acts.length+hero+board.length,bb:100,hero,hole:hole.map(C),board:board.map(C),positions,log,
   players:Object.keys(positions).map(id=>({id,stack:10000-committed[id],committed:0,totalCommitted:committed[id],folded:['u','h','s',...folded].includes(id),allIn:false})),
   legal:{check:true,call:false,callAmount:0,raise:true,minRaiseTo:100,maxRaiseTo:9750},startStacks:Object.fromEntries(Object.keys(positions).map(id=>[id,10000]))};};
 const F=['Kh','7d','2c'],sum=a=>a.reduce((x,y)=>x+y,0);
 const bb=gtoStrategy(view('g',['Ks','Qd'],F,[]),data,500);
 assert.equal(bb.source,'flop');assert.ok(Math.abs(sum(bb.freqs)-1)<1e-6);assert.ok(bb.grid&&bb.grid.KQo,'range grid for the first to act');
 const co=gtoStrategy(view('c',['As','Ad'],F,[L('flop','g','check',0,800)]),data,500);
 assert.equal(co.source,'flop');assert.ok(co.freqs[0]<0.5,'AA mostly bets the flop when checked to');
 const turn=gtoStrategy(view('g',['Ks','Qd'],[...F,'5s'],['g','c','b'].map(id=>L('flop',id,'check',0,800))),data,500);
 assert.equal(turn.source,'solver');assert.ok(Math.abs(sum(turn.freqs)-1)<1e-6);
 const hu=gtoStrategy(view('g',['Ks','Qd'],[...F,'5s'],[L('flop','g','check',0,800),L('flop','c','bet',264,800),L('flop','b','fold',0,1064,264),L('flop','g','call',264,1064,264)],['b']),data,500);
 assert.equal(hu.source,'solver');assert.ok(Math.abs(sum(hu.freqs)-1)<1e-6);
});
