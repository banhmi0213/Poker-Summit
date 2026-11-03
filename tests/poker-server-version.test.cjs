const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {createPokerRoomHTTPServer,serverVersion}=require('../lib/poker/room-http-server.ts');
test('version reports only a validated commit hash and start time',()=>{
 assert.equal(serverVersion({RAILWAY_GIT_COMMIT_SHA:'ABCDEF1234567'}).commit,'abcdef1234567');
 assert.equal(serverVersion({RAILWAY_GIT_COMMIT_SHA:'secret value'}).commit,null);
 assert.equal(serverVersion({}).commit,null);
 assert.deepEqual(Object.keys(serverVersion({SUPABASE_SERVICE_ROLE_KEY:'x'})).sort(),['commit','startedAt']);
});
test('GET /version answers without a room handler; other methods are rejected',async()=>{
 const server=createPokerRoomHTTPServer(async()=>new Response('no',{status:500}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{const r=await fetch(base+'/version');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const body=await r.json();assert.ok('commit' in body&&typeof body.startedAt==='string');
  assert.equal((await fetch(base+'/version',{method:'POST'})).status,405);}
 finally{await new Promise(r=>server.close(r));}
});
