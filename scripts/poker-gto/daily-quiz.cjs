// 今日のGTOクイズ（1日5問）を作る (owner 2026/10/31). Questions are fixed in advance per day (Japan time) so everyone
// gets the same five and past days never change when the GTO data is recomputed: existing days are kept, only
// missing days are added. 3 preflop (open / facing an open / facing a 3-bet) + 2 flop questions from different spots.
// Usage: node scripts/poker-gto/daily-quiz.cjs [--from 2026-11-01] [--days 400]
const fs=require('fs'),path=require('path'),Module=require('module');
const root=path.resolve(__dirname,'../..');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(root,r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {preflopQuestion,flopQuestion}=require(path.join(root,'lib/poker/gto-quiz.ts'));
const {GTO_SPOTS}=require(path.join(root,'lib/poker/gto-spots.ts'));
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:d;};
const out=path.join(root,'data/poker-gto/daily-quiz.json');
const pub=path.join(root,'public/poker-gto');
const preflop=JSON.parse(fs.readFileSync(path.join(pub,'preflop.json'),'utf8'));
const index=JSON.parse(fs.readFileSync(path.join(pub,'flops/index.json'),'utf8'));
// Two-player six-max spots only (three-way spots are proxies for now).
const MW=new Set(['co-btn-bb','utg-btn-bb','btn-sb-bb']);
const flopSpots=Object.entries(index).filter(([id,l])=>l.length&&GTO_SPOTS.some(s=>s.id===id)&&!MW.has(id)).map(([id])=>id);
// Interesting questions first: the hand mixes (second choice at least 3%). Pure answers are allowed after many tries.
const mixed=q=>{const f=[...q.freqs].sort((a,b)=>b-a);return (f[1]??0)>=0.03;};
const seeded=s=>()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
const seedOf=day=>[...day].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
const existing=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{version:1,days:{}};
const from=arg('from','2026-11-01'),days=Number(arg('days','400'));
let added=0;
for(let d=0;d<days;d++){
 const date=new Date(Date.parse(from+'T00:00:00Z')+d*864e5).toISOString().slice(0,10);
 if(existing.days[date])continue;
 const random=seeded(seedOf(date)),qs=[],seen=new Set();
 for(const kind of ['open','vsOpen','vs3bet']){for(let k=0;k<40;k++){const q=preflopQuestion(preflop,random,kind);if(q&&!seen.has(q.hero+q.handClass)&&(mixed(q)||k>=30)){seen.add(q.hero+q.handClass);qs.push(q);break;}}}
 const spots=[...flopSpots];
 for(let n=0;n<2&&spots.length;n++){
  for(let k=0;k<10;k++){
   const i=Math.floor(random()*spots.length),spot=spots[i],list=index[spot],flop=list[Math.floor(random()*list.length)];
   const file=JSON.parse(fs.readFileSync(path.join(pub,'flops',spot,flop+'.json'),'utf8')),info=GTO_SPOTS.find(s=>s.id===spot);
   const q=flopQuestion(file,spot,`${info.label}・フロップ`,info.detail,random);if(q&&(mixed(q)||k>=8)){qs.push(q);spots.splice(i,1);break;}
  }
 }
 if(qs.length===5){existing.days[date]=qs.map(q=>({...q,freqs:q.freqs.map(x=>Math.round(x*1000)/1000),rangeFreqs:q.rangeFreqs.map(x=>Math.round(x*1000)/1000)}));added++;}
}
existing.days=Object.fromEntries(Object.entries(existing.days).sort(([a],[b])=>a<b?-1:1));
fs.writeFileSync(out,JSON.stringify(existing));
console.log('added',added,'days, total',Object.keys(existing.days).length,'size',fs.statSync(out).size);
