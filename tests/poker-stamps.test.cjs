const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Module}=require('module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;Module._resolveFilename=function(n,p,...a){if(n.startsWith('@/'))n=root+'/'+n.slice(2);try{return resolve.call(this,n,p,...a)}catch(e){try{return resolve.call(this,n+'.ts',p,...a)}catch{}throw e}};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {StampBoard,STAMPS,stampLabel}=require('../lib/poker/stamps.ts'),{parseRingCommand,parseRingLobbyState}=require('../lib/poker/ring-admission.ts');
const id='00000000-0000-4000-8000-000000000001',table='10000000-0000-4000-8000-000000000001';
test('stamps show for 3 seconds, one per seat, and one every 3 seconds per member',()=>{
 let now=1000;const b=new StampBoard(()=>now);
 assert.equal(b.post(table,'a',1,'hello'),true);assert.equal(b.post(table,'a',1,'bye'),false,'too soon');
 now+=1000;assert.equal(b.post(table,'b',3,'nice'),true);
 assert.deepEqual(b.recent(table).map(s=>[s.seat,s.stamp,s.age]),[[1,'hello',1000],[3,'nice',0]]);
 now+=1900;assert.deepEqual(b.recent(table).map(s=>s.stamp),['hello','nice'],'still shown just under 3 seconds');
 now+=100;assert.deepEqual(b.recent(table).map(s=>s.stamp),['nice'],'gone after 3 seconds');
 now+=500;assert.equal(b.post(table,'a',1,'bye'),true);assert.deepEqual(b.recent(table).map(s=>[s.seat,s.stamp]),[[3,'nice'],[1,'bye']],'the newer stamp replaces the seat');
 now+=500;assert.equal(b.post(table,'b',3,'tilt'),true);assert.deepEqual(b.recent(table).map(s=>[s.seat,s.stamp]),[[1,'bye'],[3,'tilt']],'a newer stamp from the same seat replaces the old one');
 now+=5000;assert.deepEqual(b.recent(table),[]);
 assert.equal(stampLabel('read'),'読まれてた…');assert.equal(stampLabel('free text'),'');assert.equal(STAMPS.length,14);
 for(const [i,s] of STAMPS.entries()){assert.equal(s.image,`/images/stamps/stamp-${String(i+1).padStart(2,'0')}.webp`);assert.ok(fs.existsSync(path.join(root,'public',s.image)),s.image);assert.equal('sub' in s,false);}
 assert.deepEqual(STAMPS.slice(12).map(s=>[s.id,s.label]),[['burning','焼けてる？'],['tilt','ティルト']]);
});
test('only the fixed stamps pass the command and state checks',()=>{
 assert.deepEqual(parseRingCommand({type:'stamp',reservationId:id,requestId:id,stamp:'bye'}),{type:'stamp',reservationId:id,requestId:id,stamp:'bye'});
 assert.throws(()=>parseRingCommand({type:'stamp',reservationId:id,requestId:id,stamp:'死ね'}));
 assert.throws(()=>parseRingCommand({type:'stamp',reservationId:id,requestId:id,stamp:'bye',text:'hi'}));
 const base={wallet:{available:0,inPlay:0,total:0},membership:null,tables:[],table:null,play:null};
 assert.deepEqual(parseRingLobbyState({...base,stamps:[{seat:2,stamp:'nice',age:10}]}).stamps,[{seat:2,stamp:'nice',age:10}]);
 assert.throws(()=>parseRingLobbyState({...base,stamps:[{seat:2,stamp:'<b>',age:10}]}));
 assert.equal(parseRingLobbyState(base).stamps,undefined);
});
