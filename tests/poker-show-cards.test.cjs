const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Module}=require('module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;Module._resolveFilename=function(n,p,...a){if(n.startsWith('@/'))n=root+'/'+n.slice(2);try{return resolve.call(this,n,p,...a)}catch(e){try{return resolve.call(this,n+'.ts',p,...a)}catch{throw e}}};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {ShowBoard,SHOW_KEEP_MS}=require('../lib/poker/show-cards.ts'),{parseRingCommand,parseRingLobbyState}=require('../lib/poker/ring-admission.ts');
const id='00000000-0000-4000-8000-000000000001',table='10000000-0000-4000-8000-000000000001',hand='20000000-0000-4000-8000-000000000001',hand2='20000000-0000-4000-8000-000000000002';
const A={rank:14,suit:'s'},K={rank:13,suit:'h'};
test('a seat shows one card, then both; a new hand clears older shows; shows expire',()=>{
 let now=1000;const b=new ShowBoard(()=>now);
 b.post(table,hand,2,[A]);assert.deepEqual(b.recent(table),[{seat:2,handId:hand,cards:[A]}]);
 b.post(table,hand,2,[A,K]);assert.deepEqual(b.recent(table),[{seat:2,handId:hand,cards:[A,K]}],'showing both replaces the single card');
 b.post(table,hand2,3,[K]);assert.deepEqual(b.recent(table).map(s=>s.seat),[3],'the previous hand is gone once a newer hand is shown');
 now+=SHOW_KEEP_MS;assert.deepEqual(b.recent(table),[]);
});
test('show command and state are parsed strictly',()=>{
 for(const cards of ['first','second','both'])assert.deepEqual(parseRingCommand({type:'show',reservationId:id,requestId:id,handId:hand,cards}),{type:'show',reservationId:id,requestId:id,handId:hand,cards});
 assert.throws(()=>parseRingCommand({type:'show',reservationId:id,requestId:id,handId:hand,cards:'third'}));
 assert.throws(()=>parseRingCommand({type:'show',reservationId:id,requestId:id,handId:hand,cards:'both',extra:1}));
});
test('online table and practice table offer tap-to-show after the hand only',()=>{
 const online=fs.readFileSync(path.join(root,'app/poker-online/[roomId]/online-table-view.tsx'),'utf8'),practice=fs.readFileSync(path.join(root,'app/poker-demo/poker-table-preview.tsx'),'utf8'),panel=fs.readFileSync(path.join(root,'app/poker-ui/ring-admission-panel.tsx'),'utf8');
 assert.match(online,/onShow&&hand\?\.result&&player\.hole\?<ShowHole/);
 assert.match(online,/shownBy\(s\.seat\.seat\)/,'cards another player showed are drawn face up at their seat');
 assert.match(panel,/data\.play\?\.hand\.result\?cards=>void transport\.stamp\(\{type:'show'/,'only after the hand has a result');
 assert.match(practice,/\{payouts \? <div className=\{styles\.hole\}[^>]*data-show-hole/);
});
