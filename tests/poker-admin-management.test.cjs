const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Module}=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),load=Module._load,resolve=Module._resolveFilename;
let admin=true,suspended=false,logged=true,rpcError=null,calls=[];
const client={auth:{getUser:async()=>({data:{user:logged?{id:'1737a653-f786-4efd-80e2-cfd9a5868489'}:null}})},rpc:async(name,args)=>{calls.push({name,args});return name==='is_admin'?{data:admin}:name==='is_suspended'?{data:suspended}:{data:{id:'c714e301-8d32-4ee0-92f8-6cc884fc1020'},error:rpcError};}};
Module._load=function(name,parent,...args){if(name==='@/lib/supabase/server'||name==='@/lib/supabase/store-server')return {createClient:async()=>client,createStoreClient:async()=>client};if(name==='@/lib/revalidate')return {revalidatePath(){}};return load.call(this,name,parent,...args);};
Module._resolveFilename=function(name,parent,...args){if(name.startsWith('@/'))name=root+'/'+name.slice(2);try{return resolve.call(this,name,parent,...args);}catch(e){for(const ext of ['.ts','.tsx'])try{return resolve.call(this,name+ext,parent,...args);}catch{}throw e;}};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {validateRingSettings}=require('../lib/poker/ring-tables.ts'),{saveManagedRing,removeManagedRing}=require('../lib/poker/ring-admin.ts'),{removeManagedTournament}=require('../lib/poker/tournament-admin.ts');
const valid={title:' TEST TABLE ',capacity:6,sb:50,bb:100,min_buy_in:2000,max_buy_in:10000,note:'',published:true,sort_order:0};
const form=extra=>{const f=new FormData();for(const [k,v] of Object.entries({...valid,published:'on',revision:'0',...extra}))f.set(k,String(v));return f;};
test('ring settings accept two/six seats and reject invalid blinds, buy-in ranges and unsafe values',()=>{
 assert.equal(validateRingSettings(valid).title,'TEST TABLE');assert.equal(validateRingSettings({...valid,capacity:2}).capacity,2);
 for(const value of [{...valid,capacity:3},{...valid,sb:100},{...valid,min_buy_in:99},{...valid,max_buy_in:1999},{...valid,bb:1.5},{...valid,sort_order:1000},{...valid,sb:NaN},{...valid,note:'x'.repeat(501)},{...valid,title:''},{...valid,published:'true'}])assert.throws(()=>validateRingSettings(value));
});
test('only a signed-in, unsuspended administrator can mutate a table or remove a tournament',async()=>{
 for(const flags of [{admin:false,suspended:false,logged:true},{admin:true,suspended:true,logged:true},{admin:true,suspended:false,logged:false}]){
  ({admin,suspended,logged}=flags);calls=[];assert.equal((await saveManagedRing(form())).ok,false);assert.equal((await removeManagedTournament(form({id:'c714e301-8d32-4ee0-92f8-6cc884fc1020',title:'TEST',confirmation:'TEST'}))).ok,false);assert.equal(calls.filter(c=>c.name.startsWith('poker_admin_')).length,0);
 }admin=true;suspended=false;logged=true;
});
test('ring save forwards validated settings and revision; removal requires exact typed confirmation',async()=>{
 calls=[];assert.equal((await saveManagedRing(form())).ok,true);const saved=calls.find(c=>c.name==='poker_admin_ring_save');assert.equal(saved.args.p_id,null);assert.equal(saved.args.p_expected,0);assert.equal(saved.args.p_settings.title,'TEST TABLE');
 const details={id:'c714e301-8d32-4ee0-92f8-6cc884fc1020',title:'TEST',revision:2};calls=[];assert.equal((await removeManagedRing(form({...details,confirmation:'wrong'}))).ok,false);assert.ok(!calls.some(c=>c.name==='poker_admin_ring_remove'));assert.equal((await removeManagedRing(form({...details,confirmation:'TEST'}))).ok,true);assert.equal(calls.at(-1).args.p_expected,2);
});
test('tournament removal keeps operation in the guarded RPC and reports active-game rejection',async()=>{
 calls=[];const f=form({id:'c714e301-8d32-4ee0-92f8-6cc884fc1020',title:'TEST',confirmation:'TEST'});rpcError={message:'Tournament active or results still displayed'};const result=await removeManagedTournament(f);assert.equal(result.ok,false);assert.match(result.message,/10分/);assert.equal(calls.at(-1).name,'poker_admin_tournament_remove');rpcError=null;assert.equal((await removeManagedTournament(f)).ok,true);
});
