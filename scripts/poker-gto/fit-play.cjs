// Fit per-class playability so the 6-max 100BB open ranges match the reference (BeyondGTO) hand by hand.
const fs=require('fs'),path=require('path');process.chdir(path.resolve(__dirname,'../..'));require('./common.cjs');
const S=require(path.resolve(__dirname,'../../lib/poker/preflop-solver.ts'));
const eq=JSON.parse(fs.readFileSync('data/poker-gto/preflop-equity.json','utf8'));
const R='AKQJT98765432',L=[];for(let i=0;i<13;i++)for(let j=0;j<13;j++)L.push(i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o');
const ref={};for(const line of fs.readFileSync(path.resolve(__dirname,'../../data/poker-gto/reference/beyondgto-6max-open.txt'),'utf8').trim().split('\n')){const [p,,v]=line.split('|');const m={};v.split(',').forEach((x,k)=>m[L[k]]=Number(x)/100);ref[p]=m;}
const POS={UTG:'lj-open-6max-100bb',HJ:'hj-open-6max-100bb',CO:'co-open-6max-100bb',BTN:'btn-open-6max-100bb'};
const c=l=>l.length==2?6:l[2]=='s'?4:12;
let play=Object.fromEntries(eq.labels.map(l=>[l,S.playability(l)]));
const iters=Number(process.argv[2]||400),rounds=Number(process.argv[3]||8);
for(let r=0;r<=rounds;r++){
 S.setRealizeFit({play});const s=new S.PreflopSolver(eq,{stack:100,ante:0});s.run(iters);
 const diff=Object.fromEntries(eq.labels.map(l=>[l,0])),cnt=Object.fromEntries(eq.labels.map(l=>[l,0]));let abs=0,w=0;const rfi={};
 for(const d of s.decisions){const pos=S.POSITIONS[d.player];if(!POS[pos]||d.history.split(' ').filter(Boolean).some(t=>!t.endsWith('F')))continue;
  const st=s.strategy(d,true),k=d.actions.length,ri=d.actions.findIndex(a=>a.kind==='raise');let o=0,ww=0;
  s.labels.forEach((l,h)=>{const ours=st[h*k+ri],t=ref[POS[pos]][l];abs+=c(l)*Math.abs(ours-t);w+=c(l);o+=c(l)*ours;ww+=c(l);
   if(!(ours<0.02&&t<0.02)&&!(ours>0.98&&t>0.98)){diff[l]+=t-ours;cnt[l]++;}});rfi[pos]=(o/ww*100).toFixed(1);}
 console.log(`round ${r}: avg per-hand diff ${(abs/w*100).toFixed(2)}pt RFI ${JSON.stringify(rfi)}`);
 if(r===rounds)break;
 for(const l of eq.labels)if(cnt[l])play[l]*=Math.exp(0.12*diff[l]/cnt[l]);
 fs.writeFileSync(path.resolve(__dirname,'../../data/poker-gto/preflop-play-fit.json'),JSON.stringify({play},null,0));
}
