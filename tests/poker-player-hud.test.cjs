const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{Module}=require('module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(n,p,...args){if(n.startsWith('@/'))n=root+'/'+n.slice(2);try{return resolve.call(this,n,p,...args)}catch(e){try{return resolve.call(this,n+'.ts',p,...args)}catch{}throw e}};
let user={id:'00000000-0000-4000-8000-000000000001'};const calls=[];let rpcResult={data:null,error:null};
const client={auth:{getUser:async()=>({data:{user},error:null})},rpc:async(name,args)=>{calls.push([name,args]);return rpcResult;}};
require.extensions['.ts']=(m,f)=>{if(f.endsWith('/lib/supabase/server.ts')){m.exports={createClient:async()=>client};return;}m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);};
const hud=require('../lib/poker/player-hud.ts'),route=require('../app/api/poker/table-members/hud/route.ts'),members=require('../app/api/poker/table-members/route.ts');
const table='30000000-0000-4000-8000-000000000001',base='https://www.pokersummit.jp/api/poker/table-members';
const post=(body,origin='https://www.pokersummit.jp')=>new Request(base+'/hud',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
test('rates show a dash until there is an opportunity and no counts',()=>{
 const rows=hud.hudRows({hands:10,vpip:3,pfr:2,threeBet:1,threeBetOpp:4,cbet:0,cbetOpp:0,foldTo3Bet:1,foldTo3BetOpp:2,foldToCbet:2,foldToCbetOpp:3,sawFlop:4,wtsd:2,wsd:1});
 assert.deepEqual(rows.map(r=>r[0]),['VPIP','PFR','3ベット','CB'],'only four stats are shown (owner 2026/10/30)');
 assert.deepEqual(rows.map(r=>r[1]),['30%','20%','25%','—']);assert.ok(rows.every(r=>r.length===2),'no sample counts, rates only');
});
test('note payload validation',()=>{
 assert.deepEqual(hud.parseHudNote({table,seat:3,note:'  強め ',color:'red'}),{table,seat:3,note:'強め',color:'red'});
 for(const bad of [{table:'x',seat:3,note:'',color:null},{table,seat:7,note:'',color:null},{table,seat:3,note:'あ'.repeat(501),color:null},{table,seat:3,note:'',color:'pink'},{table,seat:3,color:null}])assert.throws(()=>hud.parseHudNote(bad));
 assert.equal(hud.parseHudNote({table,seat:1,note:'あ'.repeat(500),color:null}).note.length,500);
});
test('HUD route reads by table + seat and saves notes from the same origin only',async()=>{
 rpcResult={data:{seat:3,you:false,stats:{hands:1},note:'',color:null},error:null};
 rpcResult={data:{seat:3,you:false,stats:{hands:5,vpip:2,pfr:1,threeBet:0,threeBetOpp:1,cbet:1,cbetOpp:2,foldTo3Bet:1,foldTo3BetOpp:1,foldToCbet:1,foldToCbetOpp:1,sawFlop:3,wtsd:2,wsd:1},note:'',color:null},error:null};
 let r=await route.GET(new Request(base+`/hud?table=${table}&seat=3`));assert.equal(r.status,200);assert.deepEqual(Object.keys((await r.json()).player.stats).sort(),['cbet','cbetOpp','hands','pfr','threeBet','threeBetOpp','vpip'],'the paid-later stats never leave the server');assert.deepEqual(calls.pop(),['poker_ring_member_hud',{p_table:table,p_seat:3}]);
 assert.equal((await route.GET(new Request(base+`/hud?table=${table}&seat=9`))).status,400);
 rpcResult={data:null,error:null};assert.equal((await route.GET(new Request(base+`/hud?table=${table}&seat=2`))).status,404);
 assert.equal((await route.POST(post({table,seat:3,note:'x',color:null},'https://evil.example'))).status,403);assert.equal(calls.length,1);
 assert.equal((await route.POST(post({table,seat:3,note:'x',color:'pink'}))).status,400);
 rpcResult={data:{seat:3,note:'x',color:'blue'},error:null};
 r=await route.POST(post({table,seat:3,note:' x ',color:'blue'}));assert.equal(r.status,200);assert.deepEqual(calls.pop(),['poker_ring_member_note_set',{p_table:table,p_seat:3,p_note:'x',p_color:'blue'}]);
 user=null;assert.equal((await route.GET(new Request(base+`/hud?table=${table}&seat=3`))).status,401);user={id:'00000000-0000-4000-8000-000000000001'};
});
test('seat profiles are served on production too',async()=>{const previous=process.env.NEXT_PUBLIC_SUPABASE_URL;try{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://tjmeqnzvuoguoffltxrp.supabase.co';rpcResult={data:[{seat:1,displayName:'P1',avatarUrl:null,you:true,color:null}],error:null};
 const r=await members.GET(new Request(base+`?table=${table}`));assert.equal(r.status,200);assert.equal((await r.json()).members.length,1);assert.deepEqual(calls.pop(),['poker_ring_member_profiles',{p_table:table}]);
}finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previous;}});
