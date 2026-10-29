const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {allTextures,texture,nearestFlop,canonicalFlop}=require('../lib/poker/flop-subset.ts');
const flops=require('../data/poker-gto/flops.json');
test('all 22,100 flops fall into 1,755 kinds',()=>{const all=allTextures();assert.equal(all.length,1755);assert.equal(all.reduce((s,t)=>s+t.weight,0),22100);});
test('suit swaps are the same kind; the 200 representative flops are distinct kinds',()=>{
 assert.equal(texture('Kh7d2c').key,texture('Ks7c2d').key);assert.equal(texture('Ah9h3c').key,texture('Ad9d3s').key);assert.notEqual(texture('Ah9h3c').key,texture('Ah9d3d').key);
 assert.equal(texture('7h7d2h').key,texture('7d7h2d').key,'paired boards: which pair card carries the suit does not matter');
 assert.equal(flops.length,200);assert.equal(new Set(flops.map(f=>texture(f).key)).size,200);
});
test('nearest flop: exact kind when computed, otherwise a close texture',()=>{
 assert.deepEqual(nearestFlop('Kd7c2s',flops),{flop:'Kh7d2c',distance:0,exact:true});
 const n=nearestFlop('Ks7s3d',flops);assert.ok(n&&!n.exact);assert.equal(texture(n.flop).pattern,'hm','keeps the two-tone pattern of the high cards');
 assert.equal(nearestFlop('XX',flops),null);assert.equal(canonicalFlop('Kh7h7h'),null,'repeated card');
});
