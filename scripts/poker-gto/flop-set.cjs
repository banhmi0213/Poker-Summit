// Pick the 95 precomputed flops (2026/10/27): keep the first 30, then greedily add the flop that most lowers the
// frequency-weighted distance from every real flop to its nearest pick. Prints a JSON array of flop strings.
const path=require('path');require('./common.cjs');
const {allTextures,texture,distance,canonicalFlop}=require(path.resolve(__dirname,'../../lib/poker/flop-subset.ts'));
const FIRST=['Ah7d2c','AhKd5c','AhJd8c','Ah5d4c','AhAd7c','Kh7d2c','KhQd6c','KhTd9c','Kh8d8c','Qh8d3c','QhJdTc','Qh9d5c','Jh8d4c','JhTd7c','Th9d6c','Th7d3c','9h5d2c','8h7d5c','6h5d4c','5h4d2c','7h7d2c','QhQd5c','AhTh4c','Kh9h3c','Jh9h5c','8h6h4c','KhTh4h','7h5h2h','AhQhJh','9h8h3c'];
const all=allTextures(),total=all.reduce((s,t)=>s+t.weight,0);
const size=Number(process.argv[2]??95);
const picks=FIRST.map(f=>({flop:f,t:texture(f)}));
const near=all.map(t=>Math.min(...picks.map(p=>distance(t,p.t))));
while(picks.length<size){
 let best=-1,gain=-1;
 for(let i=0;i<all.length;i++){let g=0;for(let j=0;j<all.length;j++){const d=distance(all[j],all[i]);if(d<near[j])g+=(near[j]-d)*all[j].weight;}if(g>gain){gain=g;best=i;}}
 const t=all[best];picks.push({flop:t.example,t});for(let j=0;j<all.length;j++)near[j]=Math.min(near[j],distance(all[j],t));
}
const avg=near.reduce((s,d,j)=>s+d*all[j].weight,0)/total,worst=Math.max(...near);
console.error(`kinds ${all.length} flops ${total} picks ${picks.length} average distance ${avg.toFixed(2)} worst ${worst.toFixed(2)}`);
console.log(JSON.stringify(picks.map(p=>p.flop)));
