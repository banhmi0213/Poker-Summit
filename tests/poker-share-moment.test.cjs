const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Module}=require('module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;Module._resolveFilename=function(n,p,...a){if(n.startsWith('@/'))n=root+'/'+n.slice(2);try{return resolve.call(this,n,p,...a)}catch(e){try{return resolve.call(this,n+'.ts',p,...a)}catch{}throw e}};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {shareMoment}=require('../lib/poker/share-moment.ts');
const c=(rank,suit)=>({rank,suit});
const view=(over={},me={},opp={})=>({viewerSeat:'seat-1',hand:{handId:'h1',terms:{sb:1,bb:2},board:[c(2,'c'),c(7,'d'),c(9,'h'),c(11,'s'),c(13,'c')],
 players:[{id:'seat-1',totalCommitted:20,folded:false,allIn:false,hole:[c(14,'s'),c(3,'h')],...me},{id:'seat-2',totalCommitted:20,folded:false,allIn:false,hole:[c(4,'s'),c(5,'h')],...opp}],
 result:{showdown:true,winners:['seat-1'],payouts:{'seat-1':40}},...over}});
test('memorable hands only',()=>{
 assert.equal(shareMoment(view()),null,'an ordinary small win');
 assert.equal(shareMoment(view({result:{showdown:false,winners:['seat-1'],payouts:{'seat-1':140}}},{totalCommitted:70},{totalCommitted:70})).reason,'big','won 35BB');
 assert.equal(shareMoment(view({result:{showdown:true,winners:['seat-2'],payouts:{'seat-2':40}}},{allIn:true})).reason,'badbeat');
 const fullHouse=view({board:[c(13,'c'),c(13,'d'),c(9,'h'),c(9,'s'),c(2,'c')]},{hole:[c(13,'s'),c(3,'h')]});
 assert.equal(shareMoment(fullHouse).reason,'monster');
 assert.equal(shareMoment({...view(),spectating:true}),null,'not for spectators');
 assert.equal(shareMoment({...view(),hand:{...view().hand,result:null}}),null,'only after the hand');
});
