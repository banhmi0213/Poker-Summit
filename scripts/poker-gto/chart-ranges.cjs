// Flop-solve ranges from the preflop chart (2026/10/27): each player's starting-hand weights are the chart's
// frequencies along the spot's preflop line, so the flop solutions match how the chart (and the GTO CPUs) play.
// line: chart tokens, e.g. "UTGF HJF COF BTN2.5 SBF BBC" (F fold, C call, number = raise to in BB).
const fs=require('fs'),path=require('path');
// Heads-up lines (2026/10/29) use preflop-hu.json: SB is the button, acts first preflop and last after the flop.
const load=f=>{const c=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../public/poker-gto/'+f),'utf8'));return new Map(c.nodes.map(n=>[n.player+'|'+n.history,n]));};
const CHARTS={'6max':{byKey:load('preflop.json'),post:['SB','BB','UTG','HJ','CO','BTN']},hu:{byKey:load('preflop-hu.json'),post:['BB','SB']}};
const BLIND={SB:0.5,BB:1};
function chartSpot(line,chartName='6max'){
 const {byKey,post:POST}=CHARTS[chartName];
 const toks=line.trim().split(/\s+/).map(t=>{const m=/^(UTG|HJ|CO|BTN|SB|BB)(F|C|AI|[\d.]+)$/.exec(t);if(!m)throw Error('bad token '+t);return {pos:m[1],kind:m[2]==='F'?'F':m[2]==='C'?'C':'R',to:m[2]==='AI'?100:m[2]==='F'||m[2]==='C'?0:Number(m[2])};});
 const live=[...new Set(toks.filter(t=>t.kind!=='F').map(t=>t.pos))].filter(p=>!toks.some(t=>t.pos===p&&t.kind==='F'));
 if(live.length!==2)throw Error('line must end heads-up: '+line);
 const weights=Object.fromEntries(live.map(p=>[p,null])),put={SB:0.5,BB:1};let bet=1;
 toks.forEach((t,i)=>{
  if(t.kind==='R'){put[t.pos]=t.to;bet=t.to;}else if(t.kind==='C')put[t.pos]=bet;
  if(!live.includes(t.pos))return;
  const hist=toks.slice(0,i).map(x=>x.pos+(x.kind==='F'?'F':x.kind==='C'?'C':String(x.to))).join(' '),node=byKey.get(t.pos+'|'+hist);
  if(!node)throw Error(`no chart node for ${t.pos} after "${hist}"`);
  const j=t.kind==='F'?node.actions.findIndex(a=>a.kind==='fold'):t.kind==='C'?node.actions.findIndex(a=>a.kind==='call'||a.kind==='check'):node.actions.findIndex(a=>(a.kind==='raise'||a.kind==='allin')&&Math.abs((a.to??100)-t.to)<0.01);
  if(j<0)throw Error(`chart node ${node.id} has no action for ${t.pos}${t.kind}${t.to||''}`);
  const prev=weights[t.pos],next={};for(const [cls,row] of Object.entries(node.strategy)){const w=(prev?prev[cls]??0:1)*row[j];if(w>0.001)next[cls]=+w.toFixed(4);}
  weights[t.pos]=next;
 });
 for(const p of Object.keys(BLIND))if(put[p]===undefined)put[p]=BLIND[p];
 const pot=+Object.values(put).reduce((s,v)=>s+v,0).toFixed(2),stack=+(100-put[live[0]]).toFixed(2);
 const [oop,ip]=[...live].sort((a,b)=>POST.indexOf(a)-POST.indexOf(b));
 return {oop,ip,pot,stack,ranges:{oop:weights[oop],ip:weights[ip]}};
}
module.exports={chartSpot};
if(require.main===module)for(const l of process.argv.slice(2)){const s=chartSpot(l);console.log(l,'→',s.oop,'vs',s.ip,'pot',s.pot,'stack',s.stack,'classes',Object.keys(s.ranges.oop).length,Object.keys(s.ranges.ip).length);}
