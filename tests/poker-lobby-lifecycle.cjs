const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Module}=require('node:module'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename,load=Module._load;
Module._resolveFilename=function(name,parent,...args){if(name.startsWith('@/'))name=root+'/'+name.slice(2);try{return resolve.call(this,name,parent,...args);}catch(e){for(const ext of ['.ts','.tsx'])try{return resolve.call(this,name+ext,parent,...args);}catch{}throw e;}};
Module._load=function(name,parent,...args){if(name==='react')return React;if(name==='next/navigation')return {useRouter:()=>({refresh(){}})};if(name==='next/link')return ({href,children,...props})=>React.createElement('a',{href,...props},children);return load.call(this,name,parent,...args);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
require.extensions['.css']=m=>m.exports={__esModule:true,default:new Proxy({},{get:(_,key)=>key})};
const {act,create}=require(process.env.POKER_REACT_RENDERER_MODULE||'react-test-renderer');
const {RingLobbyList}=require('../app/poker-lobby/ring-lobby-list.tsx');
const rows=Array.from({length:7},(_,i)=>({id:String(i),title:'TABLE '+i,sb:i<4?1:5,bb:i<4?2:10,capacity:6,minBuyIn:80,maxBuyIn:200,occupied:i===0?null:i===1?6:3}));
const actions=()=>React.createElement('button',null,'参加する');
test('lobby list never fabricates occupancy and pages real tables in groups of five',async()=>{
 let r;await act(async()=>{r=create(React.createElement(RingLobbyList,{rows,renderActions:actions}));});
 const names=()=>r.root.findAllByType('strong').map(n=>n.children.join(''));
 assert.deepEqual(names(),rows.slice(0,5).map(r=>r.title));
 assert.match(JSON.stringify(r.toJSON()),/—/);
 await act(async()=>r.root.findAllByType('button').find(b=>b.children.join('')==='次へ').props.onClick());
 assert.deepEqual(names(),['TABLE 5','TABLE 6']);await act(async()=>r.unmount());
});
test('available-seat filter excludes unknown and full tables, and rate filter resets pagination',async()=>{
 let r;await act(async()=>{r=create(React.createElement(RingLobbyList,{rows,renderActions:actions}));});
 await act(async()=>r.root.findAllByType('select')[1].props.onChange({target:{value:'available'}}));
 assert.deepEqual(r.root.findAllByType('strong').map(n=>n.children.join('')),['TABLE 2','TABLE 3','TABLE 4','TABLE 5','TABLE 6']);
 await act(async()=>r.root.findAllByType('select')[0].props.onChange({target:{value:'1/2'}}));
 assert.deepEqual(r.root.findAllByType('strong').map(n=>n.children.join('')),['TABLE 2','TABLE 3']);await act(async()=>r.unmount());
});
test('guest dashboard keeps the approved sections and exposes practice without fake public records',()=>{
 const Dashboard=require('../app/poker-lobby/lobby-dashboard.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Dashboard,{guest:true,admin:false,memberName:'会員',ringEnabled:false,tournamentsEnabled:true,rings:[],ringError:false,tournaments:[],assigned:null,registration:null,board:null}));
 for(const label of ['あなたの持ちチップ','参加中の卓','着せ替え交換','持ちチップランキング','歴代大会優勝者','練習卓'])assert.ok(html.includes(label),label);
 assert.match(html,/ランキングは公開準備中/);assert.match(html,/優勝者一覧は公開準備中/);
 assert.ok(!html.includes('SUMMIT ACE'));assert.ok(!html.includes('128,400'));
});
test('practice tab retains join/watch confirmation and does not show member ring tables',async()=>{
 const Dashboard=require('../app/poker-lobby/lobby-dashboard.tsx').default;let r;
 await act(async()=>{r=create(React.createElement(Dashboard,{guest:true,admin:false,memberName:'会員',ringEnabled:false,tournamentsEnabled:true,rings:[],ringError:false,tournaments:[],assigned:null,registration:null,board:null}));});
 await act(async()=>r.root.findAllByProps({role:'tab'}).find(t=>t.children.join('')==='練習卓').props.onClick());
 let output=JSON.stringify(r.toJSON());assert.match(output,/SUMMIT BLUE 01/);assert.match(output,/会員チップの残高と連動しません/);assert.ok(!output.includes('公開リング卓'));
 await act(async()=>r.root.findAllByType('button').find(b=>b.children.join('')==='参加する').props.onClick());
 const dialog=r.root.findByProps({role:'dialog'});assert.ok(dialog.findAllByType('a').some(a=>a.props.href==='/poker-demo'));
 await act(async()=>r.unmount());
});
test('account theme switches the selected detail without leaking other pane content',async()=>{
 const Workspace=require('../app/poker-ui/workspace.tsx').PokerWorkspace;let r;
 await act(async()=>{r=create(React.createElement(Workspace,{kind:'account',panes:[{id:'ring',label:'チップ残高・順位',eyebrow:'BALANCE',description:'残高',content:React.createElement('p',null,'balance detail')},{id:'hands',label:'ハンド履歴',eyebrow:'HISTORY',description:'再生',content:React.createElement('p',null,'history detail')}]}));});
 assert.equal(r.root.findAllByProps({'data-poker-account':'champagne'}).length,1);
 assert.match(JSON.stringify(r.toJSON()),/balance detail/);assert.ok(!JSON.stringify(r.toJSON()).includes('history detail'));
 await act(async()=>r.root.findAllByType('button').find(b=>b.props['aria-pressed']===false&&b.findAllByType('span').some(n=>n.children.join('')==='ハンド履歴')).props.onClick());
 assert.match(JSON.stringify(r.toJSON()),/history detail/);assert.ok(!JSON.stringify(r.toJSON()).includes('balance detail'));
 assert.ok(r.root.findAllByType('a').some(a=>a.props.href==='/mypage/poker/hands'));
 await act(async()=>r.unmount());
});
test('single hand replay uses the same account theme and preserves the supplied controls',()=>{
 const Workspace=require('../app/poker-ui/workspace.tsx').PokerWorkspace;
 const html=renderToStaticMarkup(React.createElement(Workspace,{kind:'account',panes:[{id:'replay',label:'ハンドを再生',eyebrow:'HAND REPLAY',description:'公開された手札のみ',content:React.createElement('button',{type:'button'},'次へ')}]}));
 assert.match(html,/data-poker-account="champagne"/);assert.match(html,/ハンドを再生/);assert.match(html,/次へ/);assert.match(html,/href="\/mypage\/poker"/);
});
