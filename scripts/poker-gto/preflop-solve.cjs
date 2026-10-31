// Solve the simplified 6-max preflop game (lib/poker/preflop-solver.ts) and write public/poker-gto/preflop.json.
// Usage: node scripts/poker-gto/preflop-solve.cjs [--iters 2000]
const fs=require('fs'),path=require('path');require('./common.cjs');
const {PreflopSolver,positionsFor}=require(path.resolve(__dirname,'../../lib/poker/preflop-solver.ts'));
const equity=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/poker-gto/preflop-equity.json'),'utf8'));
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:d;};
// --fit file (2026/10/29): realisation fitted from the per-hand flop EVs (scripts/poker-gto/calibrate-hands.cjs).
const fitFile=arg('fit');if(fitFile){require(path.resolve(__dirname,'../../lib/poker/preflop-solver.ts')).setRealizeFit(JSON.parse(fs.readFileSync(fitFile,'utf8')));console.log('realisation fit',fitFile);}
// --stack N --ante A (2026/10/30): tournament depths, e.g. --stack 20 --ante 1 (big blind ante) → preflop-20bb.json.
const stack=Number(arg('stack',100)),ante=Number(arg('ante',0));
// --rake BPS --rake-cap BB (2026/10/31): cash-game rake, e.g. --rake 300 --rake-cap 3 → preflop-rake300-3.json.
const rakeBps=Number(arg('rake',0)),rakeCap=Number(arg('rake-cap',0)),rake=rakeBps>0?{bps:rakeBps,capBb:rakeCap>0?rakeCap:Infinity}:undefined;
// --seats 8|9 (owner 2026/11/1: 大会・リングは8〜9人卓が基本) → preflop-9max.json, preflop-9max-40bb.json, preflop-9max-rake500-5.json.
const seats=Number(arg('seats',6)),POSITIONS=positionsFor(seats),tag=seats===6?'':`-${seats}max`;
const iters=Number(arg('iters',2000)),s=new PreflopSolver(equity,{stack,ante,seats,...(rake?{rake}:{})}),t0=Date.now();
const terminals=(function count(n){return n.type==='terminal'?1:n.children.reduce((a,c)=>a+count(c),0);})(s.root);
console.log(`decisions ${s.decisions.length} terminals ${terminals}`);
while(s.iterations<iters){s.run(50);console.log(`iter ${s.iterations} avg regret ${s.averageRegret().toFixed(5)}BB ${((Date.now()-t0)/1000).toFixed(0)}s`);}
const round=v=>Math.round(v*1000)/1000;
// Situation and a Japanese title from the action history ("UTGF HJ2.5 COC" ...).
function describe(d){
 const toks=d.history.trim()?d.history.trim().split(' '):[],acts=toks.map(t=>{const m=/^(UTG\+\d|UTG|LJ|HJ|CO|BTN|SB|BB)(.*)$/.exec(t);return {who:m[1],what:m[2]};});
 const raises=acts.filter(a=>a.what!=='F'&&a.what!=='C'),me=POSITIONS[d.player],caller=acts.find(a=>a.what==='C');
 // Small blind limp lines (2026/10/29).
 if(acts.some(a=>a.who==='SB'&&a.what==='C')&&!acts.some(a=>a.what!=='F'&&a.what!=='C'&&a.who!=='BB'&&a.who!=='SB')){
  if(raises.length===0)return {kind:'vsLimp',title:'SBがリンプ → BB（チェックかレイズ）'};
  if(raises.length===1)return {kind:'vsIso',title:'SBのリンプにBBがレイズ → SB'};
  if(raises.length===2)return {kind:'vs3bet',title:'リンプ後のBBのレイズにSBが3ベット → BB'};
  return {kind:'vs5bet',title:'BBがオールイン → SB'};
 }
 if(!raises.length)return {kind:'open',title:`${me}：誰も参加していない（オープンするか）`};
 const [o,t,f,j]=raises;
 if(caller&&raises.length>=2&&acts.findIndex(a=>a===caller)<acts.findIndex(a=>a===t))return {kind:'vsSqueeze',title:`${o.who}がオープン、${caller.who}がコール、${t.who}がスクイーズ → ${me}`};
 if(caller)return {kind:'overcall',title:`${o.who}がオープン、${caller.who}がコール → ${me}`};
 if(raises.length===1)return {kind:'vsOpen',title:o.what==='AI'?`${o.who}がオールイン → ${me}`:`${o.who}のオープン → ${me}`};
 if(raises.length===2)return {kind:'vs3bet',title:`${o.who}のオープンに${t.who}が3ベット → ${me}`};
 if(raises.length===3)return {kind:'vs4bet',title:`${o.who}オープン、${t.who}が3ベット、${o.who}が4ベット → ${me}`};
 return {kind:'vs5bet',title:`${t.who}がオールイン（5ベット） → ${me}`};
}
const nodes=s.decisions.map(d=>{const st=s.strategy(d,true),k=d.actions.length;
 return {id:d.id,player:POSITIONS[d.player],history:d.history.trim(),...describe(d),facing:d.facing,actions:d.actions,
  strategy:Object.fromEntries(s.labels.map((l,h)=>[l,Array.from({length:k},(_,a)=>round(st[h*k+a]))]))};});
const deep=stack>=100&&!ante&&!rake;
const sizeNote=deep?'オープン2.5BB（SB 3BB）、3ベットはIP 3倍・ブラインドから11BB（SB対BBは9BB）、4ベットは2.2〜2.5倍、5ベットはオールイン'
 :`オープン${stack>=50?2.5:stack>=30?2.2:2}BB（SB ${stack>=50?3:2.5}BB）${stack<=25?'・オープンオールインあり':''}、3ベット・4ベットはスタックの45%以上になるときはオールイン`;
const rakeText=rake?`レーキ${rakeBps/100}%・上限${rakeCap}BB（フロップまで進んだポットだけ）`:'レーキなし';
const sizeNote2=rake?'オープン2.5BB（SB 3BB）、3ベットはIP 3倍・ブラインドから11BB（SB対BBは9BB）、4ベットは2.2〜2.5倍、5ベットはオールイン':sizeNote;
const out={version:1,model:`simplified-${seats}max-${stack}bb${ante?`-ante${ante}`:''}${rake?`-rake${rakeBps}-${rakeCap}`:''}`,seats,stack,ante,...(rake?{rake:{bps:rakeBps,capBb:rakeCap}}:{}),assumptions:[`${stack}BB・${seats}人卓・${ante?`BBアンティ${ante}BB`:'アンティなし'}・${rakeText}`,sizeNote2,'リンプはSBだけ（SBまで全員降りたとき）。BBはチェックか4BBにレイズ、SBはフォールド・コール・12BBに3ベット。オープンにコールが入ったら、後ろの人はスクイーズ（10BB、ブラインドから12BB）でき、BBだけはコールでも参加できる（3人まで）。スクイーズにはオープナーがフォールド・コール・オールイン、コーラーがフォールド・コール。それ以外は1対1','フロップ以降は打ち合わず、オールイン時の勝率をポジションと手の打ちやすさで補正した取り分で評価'+(deep||rake?'':'（スタックが浅いほど、補正を小さくしています）'),...(rake?['レーキは、フロップのあとにポットが大きくなる分も見込んで（リンプ・シングルレイズは2.5倍、3ベットは1.6倍、4ベットは1.2倍）、上限までを勝った人の取り分から引いています']:[])],iterations:s.iterations,averageRegret:+s.averageRegret().toFixed(5),minutes:+((Date.now()-t0)/60000).toFixed(1),nodes};
// --ev file (2026/10/31): also write each action's EV per hand (big blinds) for the trainer's EV loss.
const evFile=arg('ev');if(evFile){const ev=s.actionEvs(),r2=v=>Math.round(v*100)/100;
 fs.writeFileSync(evFile,JSON.stringify({version:1,model:out.model,iterations:s.iterations,unit:'bb',
  note:'EV of each action for each hand at each decision, against the chart (average strategy). Same order as actions in the chart file.',
  nodes:s.decisions.map(d=>{const k=d.actions.length,e=ev[d.id];return {id:d.id,history:d.history.trim(),ev:Object.fromEntries(s.labels.map((l,h)=>[l,Array.from({length:k},(_,a)=>r2(e[h*k+a]))]))};})}));
 console.log('saved',evFile);}
const file=arg('out',path.resolve(__dirname,'../../public/poker-gto/'+(rake?`preflop-rake${rakeBps}-${rakeCap}.json`:deep?'preflop.json':`preflop-${stack}bb.json`).replace(/^preflop/,'preflop'+tag)));fs.writeFileSync(file,JSON.stringify(out));console.log('saved',file,nodes.length,'decisions');
