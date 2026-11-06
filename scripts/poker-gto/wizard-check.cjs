// Check a preflop chart against reference strategies read from GTO Wizard (verification only, 2026/11/06).
// Reference files: <dir>/<wizard preflop_actions>.txt  ("root" = first decision), line 1 totals, line 2 "AKs R36C64,...".
// Pass marks (owner 2026/11/06): overall frequency of each action within ±1 point; hands within ±5, none beyond ±10.
// Usage: node scripts/poker-gto/wizard-check.cjs <chart.json> <ref dir> [--detail]
const fs=require('fs'),path=require('path');
const [chartFile,dir]=process.argv.slice(2),detail=process.argv.includes('--detail');
const chart=JSON.parse(fs.readFileSync(chartFile,'utf8'));
const NAMES=['UTG','HJ','CO','BTN','SB','BB'],R='AKQJT98765432',labels=[];
for(let i=0;i<13;i++)for(let j=0;j<13;j++)labels.push(i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o');
const combos=l=>l.length===2?6:l[2]==='s'?4:12;
const kind=a=>{const l=a.label??a;return /フォールド/.test(l)?'F':/チェック/.test(l)?'X':/コール|リンプ/.test(l)?'C':/オールイン/.test(l)?'A':'R';};
function history(acts){return acts.map((a,i)=>NAMES[i]+(a==='F'?'F':a==='C'?'C':a.slice(1))).join(' ');}
// Wizard action string to our history: actors follow the seat order, skipping folded players after the first round.
function toHistory(code){
 if(code==='root')return '';const acts=code.split('-'),live=[0,1,2,3,4,5],out=[];let i=0,folded=new Set();
 for(const a of acts){while(folded.has(live[i%6]))i++;const p=live[i%6];out.push(NAMES[p]+(a==='F'?'F':a==='C'?'C':a.slice(1)));if(a==='F')folded.add(p);i++;}
 return out.join(' ');
}
let pass=0,total=0;
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.txt')).sort()){
 const [l1,l2]=fs.readFileSync(path.join(dir,f),'utf8').split('\n'),code=f.replace(/\.txt$/,''),hist=toHistory(code);
 let node=chart.nodes.find(n=>n.history===hist),h2=hist;total++;
 // Our tree skips the folds of players behind a 3-bettor: drop trailing folds until the line is found.
 while(!node&&/ \S+F$/.test(h2)){h2=h2.replace(/ \S+F$/,'');node=chart.nodes.find(n=>n.history===h2);}
 if(!node){console.log(`${code.padEnd(22)} ${hist}: not in chart`);continue;}
 const ks=node.actions.map(kind),ref={};for(const l of labels)ref[l]={F:100};
 for(const tok of (l2||'').split(',').filter(Boolean)){const [l,v]=tok.split(' ');const f={};let rest=100;for(const m of v.matchAll(/([RCA])(\d+)/g)){f[m[1]]=+m[2];rest-=+m[2];}f.F=Math.max(0,rest);ref[l]=f;}
 // Hands outside the range reaching this node have no frequency in our chart weight: use combos × reach if present.
 // Reach of each hand of the acting player: product of its own earlier actions along the line (1 for a first decision).
 const toks=h2?h2.split(' '):[],reach={};for(const l of labels)reach[l]=1;
 for(let i=0;i<toks.length;i++){const pre=toks.slice(0,i).join(' '),prev=chart.nodes.find(n=>n.history===pre);if(!prev||prev.player!==node.player)continue;
  const t=toks[i].replace(/^(UTG|HJ|CO|BTN|SB|BB)/,''),k=t==='F'?'F':t==='C'?'C':t==='AI'?'A':'R',ai=prev.actions.map(kind).indexOf(k);
  for(const l of labels)reach[l]*=ai<0?0:prev.strategy[l][ai];}
 const tot={},wtot={},offs=[];let W=0,Wr=0;
 for(const l of labels){const s=node.strategy[l];if(!s)continue;const w=combos(l)*reach[l];W+=w;ks.forEach((k,i)=>tot[k]=(tot[k]??0)+s[i]*w);if(reach[l]<0.05)continue;
  const ours={};ks.forEach((k,i)=>ours[k]=(ours[k]??0)+s[i]*100);
  const r=ref[l];let worst=0;for(const k of new Set([...Object.keys(ours),...Object.keys(r)])){const d=Math.abs((ours[k]??0)-(r[k]??0));if(d>worst)worst=d;}
  const inRange=Object.entries(r).some(([k,v])=>k!=='F'&&v>0)||ks.length>2;
  if(worst>5)offs.push([l,Math.round(worst),Object.entries(r).filter(([k,v])=>v).map(([k,v])=>k+Math.round(v)).join(''),Object.entries(ours).filter(([k,v])=>v>=0.5).map(([k,v])=>k+Math.round(v)).join('')]);
 }
 const big=offs.filter(o=>o[1]>10).length,mid=offs.length-big,usTot=Object.entries(tot).map(([k,v])=>k+' '+(v/W*100).toFixed(1)).join(' | ');
 const ok=big===0;if(ok)pass++;
 console.log(`${code.padEnd(22)} ${(hist||'(first)').padEnd(30)} \n   W  ${l1.replace('total: ','')}\n   us ${usTot}\n   hands >10: ${big}, 5-10: ${mid}`);
 if(detail)console.log('   '+offs.sort((a,b)=>b[1]-a[1]).map(o=>`${o[0]} W ${o[2]} / us ${o[3]}`).join(', '));
}
console.log(`pass ${pass}/${total}`);
