const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
function load(file,mocks){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(name in mocks)return mocks[name];throw Error(name);},mod,mod.exports);return mod.exports;}
test('home rail loads public metadata in newest order and includes older result pages',async()=>{
 const calls=[];let count=0;const db={from:(table)=>{calls.push(['from',table]);const q={select:(v)=>{calls.push(['select',v]);return q;},eq:(...v)=>{calls.push(['eq',...v]);return q;},order:(...v)=>{calls.push(['order',...v]);return q;},range:async(start,end)=>{calls.push(['range',start,end]);return {data:count++===0?Array.from({length:500},(_,i)=>({id:String(i)})):[{id:'old'}],error:null};}};return q;}};
 const {loadHomeBlogEntries}=load('lib/home-blog.ts',{'server-only':{},'next/cache':{unstable_cache:f=>f},'./supabase/anon':{createAnonClient:()=>db}});
 const entries=await loadHomeBlogEntries();assert.equal(entries.length,501);assert.equal(entries.at(-1).id,'old');assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='active'&&c[2]===true));assert.deepEqual(calls.filter(c=>c[0]==='order')[0],['order','created_at',{ascending:false}]);assert.ok(!calls.find(c=>c[0]==='select')[1].includes('body'));assert.deepEqual(calls.filter(c=>c[0]==='range'),[['range',0,499],['range',500,999]]);
});
test('home rail does not return a partial list when a later query fails',async()=>{
 const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({data:null,error:new Error('unavailable')})};
 const {loadHomeBlogEntries}=load('lib/home-blog.ts',{'server-only':{},'next/cache':{unstable_cache:f=>f},'./supabase/anon':{createAnonClient:()=>({from:()=>q})}});await assert.rejects(loadHomeBlogEntries,/unavailable/);
});
