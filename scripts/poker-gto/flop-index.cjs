// Write public/poker-gto/flops/index.json: which flops are computed for each spot (used by the flop page and the quiz),
// then aggregate.json (flop-aggregate.cjs).
const fs=require('fs'),path=require('path');
const dir=path.resolve(__dirname,'../../public/poker-gto/flops'),out={};
for(const spot of fs.readdirSync(dir).filter(f=>fs.statSync(path.join(dir,f)).isDirectory()).sort())
 out[spot]=fs.readdirSync(path.join(dir,spot)).filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)).sort();
fs.writeFileSync(path.join(dir,'index.json'),JSON.stringify(out));
console.log(Object.entries(out).map(([k,v])=>`${k}:${v.length}`).join(' '));
require('./flop-aggregate.cjs');
