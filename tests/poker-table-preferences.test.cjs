const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{Module}=require('module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(n,p,...args){if(n.startsWith('@/'))n=root+'/'+n.slice(2);try{return resolve.call(this,n,p,...args)}catch(e){try{return resolve.call(this,n+'.ts',p,...args)}catch{}throw e}};
let stored={},writes=[];const user={id:'00000000-0000-4000-8000-000000000001',user_metadata:{}};
const client={auth:{getUser:async()=>({data:{user:{...user,user_metadata:stored}},error:null}),updateUser:async value=>{writes.push(value);stored=value.data;return {error:null}}}};
require.extensions['.ts']=(m,f)=>{if(f.endsWith('/lib/supabase/server.ts')){m.exports={createClient:async()=>client};return;}m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);};
const route=require('../app/api/poker/table-preferences/route.ts'),settings={bb:true,multipliers:[2.5,3.5,5],potPercentages:[25,60,75,110],raiseMultipliers:[2.2,3,4,5],runItTwice:'twice'};
const request=(body,origin='https://preview.example')=>new Request('https://preview.example/api/poker/table-preferences',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
test('member settings save on every environment, reject account switches and round-trip the selected values',async()=>{const previous=process.env.NEXT_PUBLIC_SUPABASE_URL;try{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://tjmeqnzvuoguoffltxrp.supabase.co';assert.equal((await route.POST(request({accountId:'other',settings}))).status,409);assert.equal(writes.length,0);assert.equal((await route.POST(request({accountId:user.id,settings},'https://other.example'))).status,403);
 assert.equal((await route.POST(request({accountId:user.id,settings}))).status,200);assert.deepEqual(writes,[{data:{poker_bet_preferences:settings}}]);const body=await (await route.GET()).json();assert.deepEqual(body,{settings,accountId:user.id});
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previous;}});
