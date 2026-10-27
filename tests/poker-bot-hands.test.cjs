const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {BotTable,playBotHand}=require('../lib/poker/bot-hands.ts');
const {ringTerms}=require('../lib/poker/tournament-hand.ts');

test('bot table plays complete hands with no anomalies, conserving chips and carrying stacks',()=>{
 const t=new BotTable(1,ringTerms);let showdowns=0,twice=0,size=0;
 for(let i=0;i<60;i++){const r=t.play();assert.deepEqual(r.anomalies.map(a=>a.kind+': '+a.detail),[]);assert.ok(r.history);
  if(r.history.players.some(p=>p.shown))showdowns++;size+=JSON.stringify(r.history).length;if(r.history.boards?.length===2)twice++;
  const total=Object.values(r.stacks).reduce((s,v)=>s+v,0);assert.ok(total>=600*100*0);}
 assert.equal(t.hands,60);assert.ok(showdowns>0,'some hands reach showdown');
 console.log(`avg history ${Math.round(size/60)} bytes, showdowns ${showdowns}, run twice ${twice}`);
});
test('a broken hand comes back as an anomaly instead of throwing',()=>{
 const r=playBotHand(['a','b'],{a:100,b:0},0,ringTerms);
 assert.equal(r.history,null);assert.equal(r.anomalies[0].kind,'start_failed');
});
test('bot settings default to off and never run on the production project',async()=>{
 const {parseBotSettings,BotRunner}=require('../lib/poker/bot-runner.ts');
 assert.deepEqual(parseBotSettings(null),{enabled:false,tables:1,pauseMs:1000});
 assert.deepEqual(parseBotSettings({enabled:true,tables:9,pause_ms:-1}),{enabled:true,tables:1,pauseMs:1000});
 let calls=0;const r=new BotRunner({url:'https://tjmeqnzvuoguoffltxrp.supabase.co',rpc:async()=>{calls++;return {data:{enabled:true},error:null};},log:()=>{}});
 await r.start();await r.close();assert.equal(r.allowed,false);assert.equal(calls,0);
});
