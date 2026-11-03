const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {parseShop,parseAdminShop,shopError}=require('../lib/poker/shop.ts');
test('chip exchange view: priced items, owned tickets and history are validated',()=>{
 const view=parseShop({available:850,items:[{code:'rabbit',label:'ラビット',description:'残りのボード',price:100}],tickets:{rabbit:2},history:[{item:'rabbit',label:'ラビット',quantity:2,total:200,createdAt:'2026-10-27T01:00:00Z'}]});
 assert.equal(view.available,850);assert.equal(view.items[0].price,100);assert.deepEqual(view.tickets,{rabbit:2});assert.equal(view.history[0].total,200);
 assert.throws(()=>parseShop({available:-1,items:[],tickets:{}}));
 assert.throws(()=>parseShop({available:0,items:[{code:'rabbit',label:'x',description:'',price:null}],tickets:{}}),'unpriced items are never offered');
 assert.throws(()=>parseShop({available:0,items:[],tickets:{'Bad Code':1}}));
});
test('admin view allows an unset price; error messages are in Japanese',()=>{
 assert.deepEqual(parseAdminShop([{code:'time_bank',label:'タイムバンク +30秒',description:'',price:null,active:true}])[0].price,null);
 assert.equal(shopError('Insufficient chips'),'使用可能なchipが足りません。');
});
