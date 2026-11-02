// Write public/poker-gto/flops/aggregate.json (2026/10/30): for every spot and computed flop, how the whole range plays
// the first decision (the player out of position) and the in-position player's answer to a check, plus how many of the
// 22,100 real flops each computed flop stands for (nearest texture). The flop page shows these as a sortable table and
// as averages by board type ("A high", "paired", "monotone", ...), weighted by how often each board occurs.
// Run after importing flops (flop-index.cjs calls it).
const fs=require('fs'),path=require('path');require('./common.cjs');
const {allTextures,texture,distance}=require(path.resolve(__dirname,'../../lib/poker/flop-subset.ts'));
const dir=path.resolve(__dirname,'../../public/poker-gto/flops'),textures=allTextures(),out={};
const round=v=>Math.round(v*1000)/1000;
const totals=node=>Object.fromEntries(node.actions.map((a,i)=>[a.label,round(node.total[i])]));
for(const spot of fs.readdirSync(dir).filter(f=>fs.statSync(path.join(dir,f)).isDirectory()).sort()){
 const files=fs.readdirSync(path.join(dir,spot)).filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(fs.readFileSync(path.join(dir,spot,f),'utf8')));
 if(!files.length)continue;
 const tex=files.map(d=>texture(d.flop)),weight=new Array(files.length).fill(0);
 for(const t of textures){let best=0,bd=Infinity;tex.forEach((x,i)=>{const d=distance(t,x);if(d<bd){bd=d;best=i;}});weight[best]+=t.weight;}
 out[spot]={seats:files[0].spot.order??[files[0].spot.oop,files[0].spot.ip],flops:files.map((d,i)=>{
  const root=d.nodes[0],check=root.actions.findIndex(a=>a.kind==='check'),next=check>=0?root.children[check]:null,ip=next!==null&&next!==undefined?d.nodes[next]:null;
  return {flop:d.flop,weight:weight[i],version:d.version??1,first:totals(root),afterCheck:ip&&ip.player!==root.player?totals(ip):null,
   ...(d.ev&&!d.multiway?{ev:{oop:round(d.ev.oop),ip:round(d.ev.ip)},pot:d.spot.pot}:{})};
 })};
}
fs.writeFileSync(path.join(dir,'aggregate.json'),JSON.stringify(out));
console.log('aggregate',Object.entries(out).map(([k,v])=>`${k}:${v.flops.length}`).join(' '));
