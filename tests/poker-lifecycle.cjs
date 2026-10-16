// Actual React state/effect/button flow with a controlled clock and deal action.
// No DOM/browser, database or network. CI installs a pinned renderer outside the app.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Module,createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),req=createRequire(root+'/package.json'),ts=req('typescript'),React=req('react');
const originalLoad=Module._load,originalResolve=Module._resolveFilename;
let calls=[];const card=(rank,suit)=>({rank,suit}),board=[card(2,'c'),card(3,'d'),card(4,'h'),card(7,'s'),card(8,'c')];
const holes={you:[card(13,'c'),card(13,'d')],p5:[card(14,'c'),card(14,'d')],p3:[card(12,'c'),card(12,'d')],p2:[card(11,'c'),card(11,'d')],p4:[card(10,'c'),card(10,'d')],p6:[card(9,'c'),card(9,'d')]};
Module._load=function(name,parent,...args){
 if(name==='react')return React;
 if(name==='./actions'&&parent?.filename.endsWith('/app/poker-demo/poker-table-preview.tsx'))return {requestDemoDeal:async(button,live)=>{calls.push({button,live});return {board,holes:Object.fromEntries(live.map(id=>[id,holes[id]]))};}};
 return originalLoad.call(this,name,parent,...args);
};
Module._resolveFilename=function(name,parent,...args){if(name.startsWith('@/'))name=root+'/'+name.slice(2);try{return originalResolve.call(this,name,parent,...args);}catch(e){for(const ext of ['.ts','.tsx'])try{return originalResolve.call(this,name+ext,parent,...args);}catch{}throw e;}};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
require.extensions['.css']=m=>m.exports={__esModule:true,default:new Proxy({},{get:(_,key)=>key})};
const {create,act}=require(process.env.POKER_REACT_RENDERER_MODULE||'react-test-renderer'),Component=req(root+'/app/poker-demo/poker-table-preview.tsx').default;
const text=node=>node==null?'':typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):text(node.children);
async function lifecycle(youBust=false){
 calls=[];if(youBust)[holes.you,holes.p2]=[holes.p2,holes.you];
 let exitPath=null;let now=Date.parse('2026-10-16T10:00:00Z'),counter=0,renderer;const timers=new Map(),oldNow=Date.now,oldWindow=global.window,oldDocument=global.document;
 const schedule=(fn,delay=0,repeat=0)=>{const id=++counter;timers.set(id,{fn,at:now+delay,repeat});return id;};
 Date.now=()=>now;global.window={location:{assign:path=>{exitPath=path;}},setTimeout:(fn,ms)=>schedule(fn,ms),clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>schedule(fn,ms,ms),clearInterval:id=>timers.delete(id)};
 global.document={addEventListener(){},removeEventListener(){}};
 const advance=async ms=>{const target=now+ms;for(let i=0;;i++){assert.ok(i<10000);const candidate=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!candidate)break;const [id,t]=candidate;now=t.at;timers.delete(id);if(t.repeat)timers.set(id,{...t,at:now+t.repeat});await act(async()=>{t.fn();});}now=target;};
 const button=name=>renderer.root.findAllByType('button').find(b=>text(b)===name);
 const click=async b=>{assert.ok(b);assert.ok(!b.props.disabled);await act(async()=>{await b.props.onClick();});};
 try{
  const tournament={id:'sample',title:'Elimination UI test',owner_store_id:null,starts_at:new Date(now).toISOString(),published:false,image_url:null,structure:{startingStack:200,anteType:'bb',lateRegLevel:0,reentry:false,periods:[{kind:'level',minutes:20,sb:50,bb:100,ante:100,note:''}]}};
  await act(async()=>{renderer=create(React.createElement(Component,{member:{displayName:'TEST',avatarUrl:null},initialDeal:{board,holes},tournament,serverNow:now}));});
  await advance(3000);await click(button('ALL-IN額'));await click(renderer.root.findByProps({className:'actions'}).findAllByType('button')[3]);await advance(6000);
  assert.match(text(renderer.toJSON()),/残り 2人 ／ 開始 6人・ヘッズアップ/);
  assert.equal(renderer.root.findAllByProps({className:'eliminatedTag'}).filter(n=>text(n)==='脱落').length,4);
  await click(button('次のハンド'));assert.deepEqual(calls,[{button:1,live:youBust?['p5','p2']:['you','p5']}]);
  assert.equal(renderer.root.findAllByProps({className:'cardBack'}).length,youBust?4:2);
  assert.match(text(renderer.toJSON()),/BTN\/SB/);
  const chips=renderer.root.findAll(n=>n.type==='div'&&String(n.props.className??'').startsWith('streetBet '));assert.equal(chips.length,2);
  if(youBust){
   assert.equal(renderer.root.findAllByProps({className:'hole'}).length,0);assert.ok(button('AUTO FOLD').props.disabled);
   for(let n=0;n<5&&!text(renderer.toJSON()).includes('大会終了・優勝');n++){if(n>0)await click(button('次のハンド'));await advance(20000);}
   assert.ok(calls.every(c=>!c.live.includes('you')));
  } else {
   await advance(1000);await click(button('ALL-IN額'));await click(renderer.root.findByProps({className:'actions'}).findAllByType('button')[3]);await advance(4000);
  }
  assert.match(text(renderer.toJSON()),/大会終了・優勝：PLAYER 5/);assert.match(text(renderer.toJSON()),/残り 1人 ／ 開始 6人/);assert.match(text(renderer.toJSON()),/あなたは脱落しました/);
  assert.match(text(renderer.toJSON()),youBust?/同順位（3〜6位）：TEST/:/2位：TEST/);assert.ok(button('大会終了').props.disabled);assert.equal(calls.length,youBust?3:1);
  assert.equal(renderer.root.findByProps({'aria-label':'大会結果ログ'}).props.open,true);assert.match(text(renderer.toJSON()),/大会結果ログ/);await click(button('退出する'));assert.equal(exitPath,'/poker-lobby');assert.match(text(renderer.toJSON()),/大会終了・優勝：PLAYER 5/);
 }finally{
  if(renderer)await act(async()=>renderer.unmount());if(youBust)[holes.you,holes.p2]=[holes.p2,holes.you];Date.now=oldNow;global.window=oldWindow;global.document=oldDocument;Module._load=originalLoad;Module._resolveFilename=originalResolve;
 }
}

test('real UI progresses six players to heads-up, removes cards/blinds, then declares a champion',()=>lifecycle());
test('after your elimination, only remaining bots are dealt and play to a champion',()=>lifecycle(true));
