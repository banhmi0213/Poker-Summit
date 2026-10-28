const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Module}=require('node:module'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename,load=Module._load;
Module._resolveFilename=function(name,parent,...args){if(name.startsWith('@/'))name=root+'/'+name.slice(2);try{return resolve.call(this,name,parent,...args);}catch(e){for(const ext of ['.ts','.tsx'])try{return resolve.call(this,name+ext,parent,...args);}catch{}throw e;}};
Module._load=function(name,parent,...args){if(name==='react')return React;if(name==='next/navigation')return {useRouter:()=>({refresh(){}})};if(name==='next/link')return ({href,children,...props})=>React.createElement('a',{href,...props},children);return load.call(this,name,parent,...args);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
require.extensions['.css']=m=>m.exports={__esModule:true,default:new Proxy({},{get:(_,key)=>key})};
const {RingLobbyList}=require('../app/poker-lobby/ring-lobby-list.tsx');
const rows=Array.from({length:7},(_,i)=>({id:String(i),title:'TABLE '+i,sb:i<4?1:5,bb:i<4?2:10,capacity:6,minBuyIn:80,maxBuyIn:200,occupied:i===0?null:i===1?6:3}));
const actions=()=>React.createElement('button',null,'参加する');
test('ring list limits the first page and preserves unknown occupancy',()=>{
 const html=renderToStaticMarkup(React.createElement(RingLobbyList,{rows,renderActions:actions}));
 assert.match(html,/TABLE 0/);assert.match(html,/TABLE 4/);assert.ok(!html.includes('TABLE 5'));assert.match(html,/—/);
});
test('guest dashboard keeps the approved sections and exposes practice without fake public records',()=>{
 const Dashboard=require('../app/poker-lobby/lobby-dashboard.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Dashboard,{guest:true,admin:false,memberName:'会員',ringEnabled:false,tournamentsEnabled:true,rings:[],ringError:false,tournaments:[],assigned:null,registration:null,board:null}));
 for(const label of ['あなたの持ちチップ','参加中の卓','着せ替え交換','持ちチップランキング','歴代大会優勝者','練習卓'])assert.ok(html.includes(label),label);
 assert.match(html,/ランキングは公開準備中/);assert.match(html,/優勝者一覧は公開準備中/);
 assert.ok(!html.includes('SUMMIT ACE'));assert.ok(!html.includes('128,400'));
});
