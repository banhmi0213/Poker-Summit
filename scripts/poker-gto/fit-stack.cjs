// Fit one tournament stack depth (owner 2026/11/1「課金部分は完璧に」): per-class playability for that depth so the
// 8-max big-blind-ante open ranges match BeyondGTO's 8-handed chip-EV RFI ranges hand by hand, and the caller's
// realisation in single-raised pots so the big blind defends about as often as published figures (BB vs BTN / vs UTG).
// Writes { stack, play, role, report } to --out; the workflow merges every depth into data/poker-gto/preflop-play-fit.json
// under byStack. Usage: node scripts/poker-gto/fit-stack.cjs --stack 40 --rounds 8 --iters 400 --out out/fit-40.json
const {bestRound}=require('./fit-selection.cjs');
const fs=require('fs'),path=require('path');process.chdir(path.resolve(__dirname,'../..'));require('./common.cjs');
const S=require(path.resolve(__dirname,'../../lib/poker/preflop-solver.ts'));
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:d;};
const stack=Number(arg('stack',40)),rounds=Number(arg('rounds',8)),iters=Number(arg('iters',400)),out=arg('out',`fit-${stack}.json`);
// Published BB defence (call + 3-bet) against a single open, 30–40BB with a big blind ante (preflopwizard.app MTT guide).
const DEFEND={BTN:0.84,CO:0.78,HJ:0.70,UTG:0.57};
const eq=JSON.parse(fs.readFileSync('data/poker-gto/preflop-equity.json','utf8'));
const base=JSON.parse(fs.readFileSync('data/poker-gto/preflop-play-fit.json','utf8'));
const R='AKQJT98765432',L=[];for(let i=0;i<13;i++)for(let j=0;j<13;j++)L.push(i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o');
const ref={};for(const line of fs.readFileSync('data/poker-gto/reference/beyondgto-mtt8-rfi.txt','utf8').trim().split('\n')){
 const [n,k,v]=line.split('|'),nk=k.split('/').length,vals=v.match(new RegExp('.{'+2*nk+'}','g'));
 ref[n]=Object.fromEntries(vals.map((x,i)=>[L[i],[...Array(nk)].reduce((s,_,j)=>s+parseInt(x.slice(2*j,2*j+2),36)/100,0)]));}
const POS={UTG:'utg','UTG+1':'mp',LJ:'lj',HJ:'hj',CO:'co',BTN:'btn'};
const c=l=>l.length==2?6:l[2]=='s'?4:12;
// --init: start from an earlier fit of this depth (its play and realisation), so a re-run only refines it.
const init=arg('init',null)?JSON.parse(fs.readFileSync(arg('init'),'utf8')):null;
let play=Object.fromEntries(eq.labels.map(l=>[l,init?.play?.[l]??base.play?.[l]??S.playability(l)]));
let call=Number(arg('call',init?.role?.srp?.call??0.55));
// The caller's realisation per opener (2026/11/2): one number made the big blind defend far too much against the button
// and too little against under the gun. Seats without a published figure sit between their neighbours.
const by=Object.fromEntries(Object.keys(DEFEND).map(p=>[p,init?.role?.srp?.callBy?.[p]??call]));
const role=()=>({srp:{call,aggr:0.8,callBy:{...by,'UTG+1':+(by.UTG*2/3+by.HJ/3).toFixed(3),LJ:+(by.UTG/3+by.HJ*2/3).toFixed(3)}}});
let report=null;const snapshots=[];
fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
for(let r=0;r<=rounds;r++){
 S.setRealizeFit({...base,byStack:{[stack]:{play,role:role()}}});
 const s=new S.PreflopSolver(eq,{stack,ante:1,seats:8});s.run(iters);
 const names=S.positionsFor(8),diff=Object.fromEntries(eq.labels.map(l=>[l,0])),cnt=Object.fromEntries(eq.labels.map(l=>[l,0]));
 let abs=0,w=0;const rfi={},defend={};
 for(const d of s.decisions){
  const toks=d.history.trim().split(' ').filter(Boolean),pos=names[d.player],st=s.strategy(d,true),k=d.actions.length;
  // Opens (everyone before folded).
  if(POS[pos]&&toks.every(t=>t.endsWith('F'))){const rr=ref[`rfi-${stack}bb-${POS[pos]}`];if(!rr)continue;let o=0,ww=0;
   s.labels.forEach((l,h)=>{const ours=d.actions.reduce((x,a,i)=>x+(a.kind!=='fold'?st[h*k+i]:0),0),t=rr[l];abs+=c(l)*Math.abs(ours-t);w+=c(l);o+=c(l)*ours;ww+=c(l);
    if(!(ours<0.02&&t<0.02)&&!(ours>0.98&&t>0.98)){diff[l]+=t-ours;cnt[l]++;}});rfi[pos]=+(o/ww*100).toFixed(1);}
  // BB against a single open with everyone else folded.
  if(pos==='BB'){const raisers=toks.filter(t=>!t.endsWith('F'));if(raisers.length===1&&!/AI$/.test(raisers[0])){const opener=raisers[0].replace(/[\d.]+$/,'');
   if(DEFEND[opener]!==undefined){let f=0,ww=0;s.labels.forEach((l,h)=>{f+=s.combos[h]*st[h*k+0];ww+=s.combos[h];});defend[opener]=+(1-f/ww).toFixed(3);}}}
 }
 const defErr=Object.keys(DEFEND).filter(p=>defend[p]!==undefined).map(p=>defend[p]-DEFEND[p]),meanErr=defErr.reduce((a,b)=>a+b,0)/Math.max(1,defErr.length);
 report={round:r,perHandDiff:+(abs/w*100).toFixed(2),rfi,defend,call:+call.toFixed(3),callBy:role().srp.callBy};console.log(JSON.stringify(report));
 // Persist before updating parameters; retain the exact evaluated values without rounding.
 snapshots.push(JSON.parse(JSON.stringify({stack,play,role:role(),report})));
 fs.writeFileSync(out+'.rounds.json',JSON.stringify({stack,iters,rounds:snapshots}));
 if(r===rounds)break;
 for(const l of eq.labels)if(cnt[l])play[l]*=Math.exp(0.12*diff[l]/cnt[l]);
 // Defending too much: the caller realises too much; lower it (and the reverse).
 call=Math.min(0.95,Math.max(0.3,call*Math.exp(-0.8*meanErr)));
 for(const p of Object.keys(DEFEND))if(defend[p]!==undefined)by[p]=Math.min(0.95,Math.max(0.25,by[p]*Math.exp(-1.2*(defend[p]-DEFEND[p]))));
}
const selected=stack===40?bestRound(snapshots):snapshots.at(-1);
const result=selected??snapshots.at(-1);
fs.writeFileSync(out,JSON.stringify({...result,selection:{
 policy:stack===40?'minimum RFI difference among BB-passing rounds':'last round',
 eligible:stack===40?selected!==null:true,selectedRound:selected?.report.round??null,
 evaluatedRounds:snapshots.length,iters,complete:true
}}));
console.log('saved',out,'selected round',selected?.report.round??'none');
