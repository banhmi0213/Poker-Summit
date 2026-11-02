// Compare our 8-max tournament charts (big blind ante) with BeyondGTO's 8-handed chip-EV RFI ranges, hand by hand.
// Usage: node scripts/poker-gto/compare-mtt.cjs [chart dir] → per depth and position: our open %, theirs, avg per-hand diff.
const fs=require('fs'),path=require('path');
const R='AKQJT98765432',L=[];for(let i=0;i<13;i++)for(let j=0;j<13;j++)L.push(i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o');
const c=l=>l.length==2?6:l[2]=='s'?4:12;
const ref={};for(const line of fs.readFileSync(path.resolve(__dirname,'../../data/poker-gto/reference/beyondgto-mtt8-rfi.txt'),'utf8').trim().split('\n')){
 const [n,k,v]=line.split('|'),nk=k.split('/').length,vals=v.match(new RegExp('.{'+2*nk+'}','g'));
 ref[n]=Object.fromEntries(vals.map((x,i)=>[L[i],[...Array(nk)].reduce((s,_,j)=>s+parseInt(x.slice(2*j,2*j+2),36)/100,0)]));}
const dir=process.argv[2]||path.resolve(__dirname,'../../data/poker-gto/paid');const POS={utg:'UTG',mp:'UTG+1',lj:'LJ',hj:'HJ',co:'CO',btn:'BTN'};
let tot=0,totw=0;
for(const d of [60,40,20]){const f=path.join(dir,`preflop-8max-${d}bb.json`);if(!fs.existsSync(f))continue;const p=JSON.parse(fs.readFileSync(f,'utf8'));
 for(const [k,pos] of Object.entries(POS)){const n=p.nodes.find(n=>n.kind==='open'&&n.player===pos);const r=ref[`rfi-${d}bb-${k}`];if(!n||!r)continue;
  let o=0,t=0,w=0,abs=0;const big=[];
  for(const l of L){const v=n.strategy[l];const ours=v?n.actions.reduce((s,a,i)=>s+(a.kind!=='fold'?v[i]:0),0):0;const th=r[l];o+=c(l)*ours;t+=c(l)*th;w+=c(l);abs+=c(l)*Math.abs(ours-th);if(Math.abs(ours-th)>=0.5)big.push(`${l}(${Math.round(ours*100)}/${Math.round(th*100)})`);}
  tot+=abs;totw+=w;console.log(`${d}bb ${pos}: ours ${(o/w*100).toFixed(1)}% ref ${(t/w*100).toFixed(1)}% diff ${(abs/w*100).toFixed(1)}pt | ${big.slice(0,10).join(' ')}`);}}
console.log('overall',(tot/totw*100).toFixed(1)+'pt');
