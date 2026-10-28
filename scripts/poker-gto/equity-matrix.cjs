// Preflop all-in equity of every starting-hand class vs every class (Monte Carlo over suit combos and boards).
// Output: data/poker-gto/preflop-equity.json  {labels:[169], eq:[[169x169] * 10000 ints], samples}
const {Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const path=require('path'),fs=require('fs');
const {evalCodes,classes,combosOf,seeded}=require('./common.cjs');
const SAMPLES=Number(process.env.SAMPLES||8000);
function rowRange(start,end,seed){
 const rnd=seeded(seed),combos=classes.map(combosOf),rows=[];
 const used=new Uint8Array(52),hand=new Array(7);
 for(let i=start;i<end;i++){const row=new Array(classes.length).fill(0);
  for(let j=i;j<classes.length;j++){
   const A=combos[i],B=combos[j].filter(()=>true);let share=0,n=0;
   for(let k=0;k<SAMPLES;k++){
    const a=A[Math.floor(rnd()*A.length)],cand=B.filter(b=>b[0]!==a[0]&&b[0]!==a[1]&&b[1]!==a[0]&&b[1]!==a[1]);if(!cand.length)break;
    const b=cand[Math.floor(rnd()*cand.length)];used.fill(0);used[a[0]]=used[a[1]]=used[b[0]]=used[b[1]]=1;
    const board=[];while(board.length<5){const c=Math.floor(rnd()*52);if(!used[c]){used[c]=1;board.push(c);}}
    hand[0]=a[0];hand[1]=a[1];for(let t=0;t<5;t++)hand[2+t]=board[t];const ea=evalCodes(hand);
    hand[0]=b[0];hand[1]=b[1];const eb=evalCodes(hand);
    share+=ea>eb?1:ea===eb?0.5:0;n++;
   }
   row[j]=n?Math.round(share/n*10000):5000;
  }
  rows.push([i,row]);}
 return rows;
}
if(isMainThread){
 const W=2,n=classes.length,chunks=[];
 // Balance work: later rows are shorter, so interleave rows between workers.
 const jobs=[...Array(n).keys()];const parts=[[],[]];jobs.forEach((i,k)=>parts[k%2].push(i));
 const t=Date.now();let done=0;const eq=Array.from({length:n},()=>new Array(n).fill(0));
 parts.forEach((rows,w)=>{const worker=new Worker(__filename,{workerData:{rows,seed:1000+w}});worker.on('message',res=>{for(const [i,row] of res)for(let j=i;j<n;j++){eq[i][j]=row[j];eq[j][i]=10000-row[j];}if(++done===W){for(let i=0;i<n;i++)eq[i][i]=5000;const out=path.resolve(__dirname,'../../data/poker-gto/preflop-equity.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({labels:classes.map(c=>c.label),samples:SAMPLES,eq}));console.log('done',((Date.now()-t)/1000).toFixed(0)+'s',out);}});worker.on('error',e=>{console.error(e);process.exit(1);});});
}else{
 const out=[];for(const i of workerData.rows)out.push(...rowRange(i,i+1,workerData.seed+i));parentPort.postMessage(out);
}
