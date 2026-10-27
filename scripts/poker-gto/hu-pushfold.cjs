// Heads-up push/fold Nash equilibrium (no ante). SB (button) shoves S big blinds or folds; BB calls or folds.
// Solved by fictitious play on 169 hand classes with card-removal combo weights; reports exploitability.
// Output: data/poker-gto/hu-pushfold.json  {stacks:[...], spots:{S:{push:{label:freq}, call:{label:freq}, pushPct, callPct, exploit}}}
const fs=require('fs'),path=require('path');
const {classes,combosOf}=require('./common.cjs');
const M=require(path.resolve(__dirname,'../../data/poker-gto/preflop-equity.json'));
const n=classes.length,combos=classes.map(combosOf);
// w[i][j]: number of non-overlapping (i combo, j combo) pairs.
const w=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>{let k=0;for(const a of combos[i])for(const b of combos[j])if(a[0]!==b[0]&&a[0]!==b[1]&&a[1]!==b[0]&&a[1]!==b[1])k++;return k;}));
const eq=M.eq.map(r=>r.map(v=>v/10000));
function solve(S,iters=4000){
 let push=new Array(n).fill(0.5),call=new Array(n).fill(0.5);const pAvg=new Array(n).fill(0),cAvg=new Array(n).fill(0);
 const brSB=(cl)=>classes.map((_,i)=>{let tot=0,ev=0;for(let j=0;j<n;j++){const ww=w[i][j];if(!ww)continue;tot+=ww;ev+=ww*(cl[j]*(2*S*eq[i][j]-S)+(1-cl[j])*1);}return ev/tot>-0.5?1:0;});
 const brBB=(ps)=>classes.map((_,j)=>{let tot=0,ev=0;for(let i=0;i<n;i++){const ww=w[i][j]*ps[i];if(!ww)continue;tot+=ww;ev+=ww*(2*S*(1-eq[i][j])-S);}return tot>0&&ev/tot>-1?1:0;});
 for(let t=1;t<=iters;t++){
  const b1=brSB(call),b2=brBB(push);
  for(let i=0;i<n;i++){push[i]+= (b1[i]-push[i])/(t+1);call[i]+=(b2[i]-call[i])/(t+1);}
 }
 // Exploitability (bb per hand, averaged over all deals): how much each side gains by best-responding.
 const value=(ps,cl)=>{let tot=0,ev=0;for(let i=0;i<n;i++)for(let j=0;j<n;j++){const ww=w[i][j];if(!ww)continue;tot+=ww;ev+=ww*((1-ps[i])*-0.5+ps[i]*(cl[j]*(2*S*eq[i][j]-S)+(1-cl[j])))}return ev/tot;};
 const v=value(push,call),exploit=Math.max(0,value(brSB(call),call)-v)+Math.max(0,v-value(push,brBB(push)));
 const pct=(f)=>{let a=0,t=0;classes.forEach((c,i)=>{a+=c.combos*f[i];t+=c.combos;});return Math.round(a/t*1000)/10;};
 const pick=(f)=>Object.fromEntries(classes.map((c,i)=>[c.label,Math.round(f[i]*100)/100]).filter(([,v])=>v>=0.01));
 return {push:pick(push),call:pick(call),pushPct:pct(push),callPct:pct(call),sbValue:Math.round(v*1000)/1000,exploit:Math.round(exploit*10000)/10000};
}
const stacks=[];for(let s=2;s<=25;s+=s<10?0.5:1)stacks.push(s);
const spots={};for(const S of stacks){spots[S]=solve(S);console.log(S+'bb push',spots[S].pushPct+'%','call',spots[S].callPct+'%','exploit',spots[S].exploit);}
const out=path.resolve(__dirname,'../../data/poker-gto/hu-pushfold.json');fs.writeFileSync(out,JSON.stringify({version:1,model:'HU push/fold, no ante, SB=0.5 BB=1, fictitious play on 169 classes with card removal',equitySamples:M.samples,stacks,spots}));console.log('wrote',out);
