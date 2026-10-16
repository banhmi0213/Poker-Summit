// Exercise the real server actions with request-scoped clients; never uses live credentials.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Module,createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),req=createRequire(root+'/package.json'),ts=req('typescript');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let context,writes;
const originalLoad=Module._load,originalResolve=Module._resolveFilename;
Module._load=function(name,parent,...args){
 if(name==='@/lib/supabase/server'||name==='@/lib/supabase/store-server')return {createClient:async()=>context.client,createStoreClient:async()=>context.client};
 if(name==='@/app/matching/chat/notification-badge')return {NotificationBadge:()=>null};
 if(name==='next/navigation')return {usePathname:()=>'/store/profile/events'};
 if(name==='@/lib/revalidate')return {revalidatePath:()=>{}};
 return originalLoad.call(this,name,parent,...args);
};
Module._resolveFilename=function(name,parent,...args){if(name.startsWith('@/'))name=root+'/'+name.slice(2);try{return originalResolve.call(this,name,parent,...args);}catch(e){for(const ext of ['.ts','.tsx'])try{return originalResolve.call(this,name+ext,parent,...args);}catch{}throw e;}};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const {loadTournamentAccess}=req(root+'/lib/poker/tournament-access.ts');
const {saveManagedTournament}=req(root+'/lib/poker/tournament-admin.ts');
const {saveAccess}=req(root+'/app/admin/poker-tournaments/access/actions.ts');
const {defaultStructure}=req(root+'/lib/poker/tournament.ts');
function setup({enabled=[],lookupError=false,existing=null,admin=false,suspended=false}={}){
 writes=0;context={client:{auth:{getUser:async()=>({data:{user:{id:'owner'}}})},rpc:async name=>({data:name==='is_admin'?admin:suspended,error:null}),from(table){
  let mutation=false;
  const q={select(){return q},eq(){return q},in(){return q},order(){return q},update(){mutation=true;writes++;return q},insert(){mutation=true;writes++;return q},upsert(){mutation=true;writes++;return q},single:async()=>({data:{id:A},error:null}),maybeSingle:async()=>({data:existing,error:null}),then(resolve,reject){return Promise.resolve(table==='stores'?{data:[{id:A,name:'A'},{id:B,name:'B'}],error:null}:table==='poker_tournament_store_access'&&!mutation?{data:enabled.map(store_id=>({store_id,enabled:true})),error:lookupError?{message:'lookup failed'}:null}:{data:[],error:null}).then(resolve,reject)}};return q;
 }}};return context.client;
}
function form(owner=A,id=''){const f=new FormData();f.set('owner_store_id',owner);f.set('id',id);f.set('title','Test');f.set('starts_at','2026-11-01T12:00');f.set('structure',JSON.stringify(defaultStructure));return f;}
test('missing permission and lookup errors deny rather than enabling a store',async()=>{
 for(const lookupError of [false,true]){const client=setup({lookupError});assert.equal((await loadTournamentAccess(client,[A])).enabledIds.size,0);const r=await saveManagedTournament('store',form());assert.equal(r.ok,false);assert.match(r.message,/利用を許可/);assert.equal(writes,0);}
});
test('permission on another owned store never authorizes the requested store',async()=>{setup({enabled:[B]});const r=await saveManagedTournament('store',form(A));assert.equal(r.ok,false);assert.equal(writes,0);});
test('stale edit cannot move an unpermitted existing tournament to a permitted store',async()=>{setup({enabled:[A],existing:{id:B,owner_store_id:B}});const r=await saveManagedTournament('store',form(A,B));assert.equal(r.ok,false);assert.equal(writes,0);});
test('permitted stores save while administrators retain their independent authority',async()=>{
 if(!global.File)global.File=require('node:buffer').File;
 setup({enabled:[A]});assert.equal((await saveManagedTournament('store',form())).ok,true);assert.equal(writes,1);
 setup({admin:true});assert.equal((await saveManagedTournament('admin',form())).ok,true);assert.equal(writes,1);
});
test('permission action rejects store callers and suspended admins before writing',async()=>{
 const f=new FormData();f.set('store_id',A);f.set('enabled','true');
 for(const settings of [{admin:false},{admin:true,suspended:true}]){setup(settings);assert.equal((await saveAccess({ok:false,message:''},f)).ok,false);assert.equal(writes,0);}
});
test('only a valid admin permission request is saved; malformed flags are rejected',async()=>{
 const f=new FormData();f.set('store_id',A);f.set('enabled','true');setup({admin:true});const r=await saveAccess({ok:false,message:''},f);assert.equal(r.ok,true);assert.equal(r.enabled,true);assert.equal(writes,1);
 setup({admin:true});f.set('enabled','on');assert.equal((await saveAccess({ok:false,message:''},f)).ok,false);assert.equal(writes,0);
});

const React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {StoreSidebar}=req(root+'/app/store/(authenticated)/store-sidebar.tsx');
test('only online tournament menu is greyed out for unpermitted stores',()=>{
 const html=renderToStaticMarkup(React.createElement(StoreSidebar));
 assert.equal((html.match(/aria-disabled="true"/g)||[]).length,1);
 assert.doesNotMatch(html,/href="\/store\/profile\/poker-tournaments"/);
 assert.match(html,/href="\/store\/profile\/events"/);assert.match(html,/href="\/store\/profile\/coupons"/);
 assert.match(html,/運営の利用許可が必要/);
});
test('permitted store menu restores the online tournament link',()=>{
 const html=renderToStaticMarkup(React.createElement(StoreSidebar,{tournamentEnabled:true}));
 assert.match(html,/href="\/store\/profile\/poker-tournaments"/);assert.doesNotMatch(html,/aria-disabled="true"/);
});
