// EXPERIMENTAL (2026-10-26): results are NOT trustworthy yet (UTG opens ~36-40%, real ~15-18%). Kept for reference; do not ship its output.
// 6-max 100BB preflop approximation (no ante, SB 0.5 / BB 1).
// Model (stated on the page): opens are raise-or-fold (2.5BB, SB 3BB). Each later player facing an unraised open
// (everyone between folded) folds, calls or 3-bets (in position 3x, out of position 4x). The opener facing a 3-bet
// folds, calls or jams 100BB; the 3-bettor facing the jam folds or calls. Squeezes/multiway pots are not modelled.
// Called pots are split by equity adjusted for position (realization: in position 1.00, out of position 0.85).
// Solved by fictitious play over 169 classes with pairwise card-removal weights.
// Output: data/poker-gto/sixmax-100bb.json
const fs=require('fs'),path=require('path');
const {classes,combosOf}=require('./common.cjs');
const M=require(path.resolve(__dirname,'../../data/poker-gto/preflop-equity.json'));
const n=classes.length,combos=classes.map(combosOf),eq=M.eq.map(r=>r.map(v=>v/10000));
const W=Array.from({length:n},(_,i)=>Float64Array.from({length:n},(_,j)=>{let k=0;for(const a of combos[i])for(const b of combos[j])if(a[0]!==b[0]&&a[0]!==b[1]&&a[1]!==b[0]&&a[1]!==b[1])k++;return k;}));
const Wsum=W.map(r=>r.reduce((s,v)=>s+v,0));
const POS=['UTG','HJ','CO','BTN','SB','BB'],blind={SB:0.5,BB:1},STACK=100,R_OOP=Number(process.env.R_OOP||0.85);
const ipVs=(p,d)=>!(d==='SB'||d==='BB')||(p==='SB'&&d==='BB'); // is defender in position?
const share=(e,ip)=>ip?e/(e+R_OOP*(1-e)):R_OOP*e/(R_OOP*e+(1-e)); // player's pot share given its raw equity
const pairs=[];POS.slice(0,5).forEach((p,pi)=>POS.slice(pi+1).forEach(d=>pairs.push({p,d})));
for(const pr of pairs){const o=pr.p==='SB'?3:2.5,dIP=ipVs(pr.p,pr.d);Object.assign(pr,{o,dIP,T:dIP?3*o:4*o,dead:1.5-(blind[pr.p]??0)-(blind[pr.d]??0),ob:blind[pr.p]??0,db:blind[pr.d]??0});}
// Average strategies (fictitious play). def = [fold,call,3bet], o3 = [fold,call,jam], dj = call prob.
const S={open:Object.fromEntries(POS.slice(0,5).map(p=>[p,new Float64Array(n).fill(0.5)]))};
for(const pr of pairs){pr.def=Array.from({length:n},()=>[1/3,1/3,1/3]);pr.o3=Array.from({length:n},()=>[1/3,1/3,1/3]);pr.dj=new Float64Array(n).fill(0.5);}
const argmax=(a)=>{let k=0;for(let i=1;i<a.length;i++)if(a[i]>a[k]+1e-12)k=i;return k;};
function iterate(t){
 const lr=1/(t+1);
 // Opener best responses (open, and vs 3-bet).
 const brOpen={},brO3=new Map();
 for(const p of POS.slice(0,5)){
  const ps=pairs.filter(x=>x.p===p);brOpen[p]=new Float64Array(n);
  for(let a=0;a<n;a++){
   let reach=1,ev=0;
   for(const pr of ps){
    let fold=0,cont=0;const {o,T,dead,dIP}=pr;let evF=0,evC=0,evJ=0,w3=0;
    for(let b=0;b<n;b++){const w=W[a][b]/Wsum[a];if(!w)continue;const [f,c,r]=pr.def[b];fold+=w*f;
     const e=eq[a][b],sh=share(e,!dIP),potC=2*o+dead;cont+=w*c*(sh*potC-o);
     if(r>0){w3+=w*r;const pot3=2*T+dead,sh3=share(e,!dIP);evF+=w*r*(-o);evC+=w*r*(sh3*pot3-T);evJ+=w*r*(pr.dj[b]*(e*(2*STACK+dead)-STACK)+(1-pr.dj[b])*(T+dead));}}
    const [qf,qc,qj]=pr.o3[a];cont+=qf*evF+qc*evC+qj*evJ;
    brO3.set(pr.p+pr.d+a,argmax([evF,evC,evJ]));
    ev+=reach*cont;reach*=fold;
   }
   ev+=reach*(1.5-(blind[p]??0)) - 0; // all fold: win the blinds (own blind back)
   const evFold=-(blind[p]??0);brOpen[p][a]=ev>evFold?1:0;
  }
 }
 // Defender best responses.
 for(const pr of pairs){
  const open=S.open[pr.p],{o,T,dead,dIP,db}=pr;
  for(let b=0;b<n;b++){
   let tot=0,evC=0,ev3=0,jt=0,evJF=0,evJC=0;
   for(let a=0;a<n;a++){const w=W[a][b]*open[a];if(!w)continue;tot+=w;const e=1-eq[a][b];
    evC+=w*(share(e,dIP)*(2*o+dead)-o);
    const [qf,qc,qj]=pr.o3[a];ev3+=w*(qf*(o+dead)+qc*(share(e,dIP)*(2*T+dead)-T)+qj*(pr.dj[b]*(e*(2*STACK+dead)-STACK)+(1-pr.dj[b])*(-T)));
    const wj=w*qj;if(wj){jt+=wj;evJF+=wj*(-T);evJC+=wj*(e*(2*STACK+dead)-STACK);}}
   if(tot>0){const k=argmax([-db*tot,evC,ev3]);for(let m=0;m<3;m++)pr.def[b][m]+=((m===k?1:0)-pr.def[b][m])*lr;}
   if(jt>0){const call=evJC>evJF?1:0;pr.dj[b]+=(call-pr.dj[b])*lr;}
  }
 }
 for(const p of POS.slice(0,5))for(let a=0;a<n;a++)S.open[p][a]+=(brOpen[p][a]-S.open[p][a])*lr;
 for(const pr of pairs)for(let a=0;a<n;a++){const k=brO3.get(pr.p+pr.d+a);for(let m=0;m<3;m++)pr.o3[a][m]+=((m===k?1:0)-pr.o3[a][m])*lr;}
}
const ITERS=Number(process.env.ITERS||3000);const t0=Date.now();let prev=null;
for(let t=1;t<=ITERS;t++){iterate(t);if(t%500===0){const snap=JSON.stringify(Object.values(S.open).map(v=>Array.from(v,x=>Math.round(x*100))));const ch=prev?snap.split(',').filter((x,i)=>x!==prev.split(',')[i]).length:-1;prev=snap;console.log('iter',t,'changed cells',ch,((Date.now()-t0)/1000).toFixed(0)+'s');}}
const pct=(f)=>{let a=0,t=0;classes.forEach((c,i)=>{a+=c.combos*f(i);t+=c.combos;});return Math.round(a/t*1000)/10;};
const pick=(f)=>Object.fromEntries(classes.map((c,i)=>[c.label,Math.round(f(i)*100)/100]).filter(([,v])=>v>=0.02));
const out={version:1,model:'6-max 100BB preflop approximation: raise-or-fold opens 2.5BB (SB 3BB), 3-bet IP 3x / OOP 4x, 4-bet = all-in, no squeeze/multiway, called pots by equity with OOP realization 0.85; fictitious play on 169 classes',iterations:ITERS,
 open:Object.fromEntries(POS.slice(0,5).map(p=>[p,{range:pick(i=>S.open[p][i]),pct:pct(i=>S.open[p][i])}])),
 vsOpen:Object.fromEntries(pairs.map(pr=>[pr.p+'>'+pr.d,{call:pick(i=>pr.def[i][1]),threeBet:pick(i=>pr.def[i][2]),callPct:pct(i=>pr.def[i][1]),threeBetPct:pct(i=>pr.def[i][2]),
   vs3bet:{call:pick(i=>pr.o3[i][1]),jam:pick(i=>pr.o3[i][2])},vsJam:{call:pick(i=>pr.dj[i])}}]))};
const file=path.resolve(__dirname,'../../data/poker-gto/sixmax-100bb.json');fs.writeFileSync(file,JSON.stringify(out));
for(const p of POS.slice(0,5))console.log(p,'open',out.open[p].pct+'%');
for(const k of ['BTN>BB','CO>BTN','SB>BB','UTG>BB'])console.log(k,'call',out.vsOpen[k].callPct+'%','3bet',out.vsOpen[k].threeBetPct+'%');
