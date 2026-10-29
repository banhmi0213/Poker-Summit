// Solve the simplified heads-up preflop game (lib/poker/hu-preflop-solver.ts) and write public/poker-gto/preflop-hu.json
// (2026/10/29). Same node format as preflop.json, players SB (the button) and BB.
// Usage: node scripts/poker-gto/preflop-hu-solve.cjs [--iters 3000]
const fs=require('fs'),path=require('path');require('./common.cjs');
const {HuPreflopSolver,HU_POSITIONS}=require(path.resolve(__dirname,'../../lib/poker/hu-preflop-solver.ts'));
const equity=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/poker-gto/preflop-equity.json'),'utf8'));
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:d;};
const iters=Number(arg('iters',3000)),s=new HuPreflopSolver(equity),t0=Date.now();
while(s.iterations<iters){s.run(100);if(s.iterations%500===0)console.log(`iter ${s.iterations} avg regret ${s.averageRegret().toFixed(5)}BB ${((Date.now()-t0)/1000).toFixed(0)}s`);}
const round=v=>Math.round(v*1000)/1000;
const TITLES={'':['open','SB（ボタン）：最初の行動（フォールド・リンプ・オープン）'],'SBC':['vsLimp','SBがリンプ → BB'],'SBC BB4':['vsIso','SBのリンプにBBがレイズ → SB'],
 'SBC BB4 SB12':['vs3bet','リンプ後のレイズにSBが3ベット → BB'],'SB2.5':['vsOpen','SBのオープン → BB'],'SB2.5 BB10':['vs3bet','SBのオープンにBBが3ベット → SB'],
 'SB2.5 BB10 SB22':['vs4bet','BBの3ベットにSBが4ベット → BB'],'SBC BB4 SB12 BB26':['vs4bet','SBの3ベットにBBが4ベット → SB']};
const nodes=s.decisions.map(d=>{const st=s.strategy(d,true),k=d.actions.length,[kind,title]=TITLES[d.history]??['vs5bet',`${d.history.split(' ').pop().replace('AI','')}がオールイン → ${HU_POSITIONS[d.player]}`];
 return {id:d.id,player:HU_POSITIONS[d.player],history:d.history,kind,title,facing:d.facing,actions:d.actions,
  strategy:Object.fromEntries(s.labels.map((l,h)=>[l,Array.from({length:k},(_,a)=>round(st[h*k+a]))]))};});
const out={version:1,model:'simplified-hu-100bb',assumptions:['100BB・2人（ヘッズアップ）・アンティなし・レーキなし','ボタンがSB。SBはフォールド・リンプ・2.5BBオープン','リンプにBBは4BBにレイズ、それにSBは12BBに3ベット','オープンにBBは10BBに3ベット、4ベットは22BB（リンプ後は26BB）、その次はオールイン','フロップ以降は計算せず、勝率×実現率（SBが有利な位置）で評価'],
 iterations:s.iterations,averageRegret:+s.averageRegret().toFixed(5),minutes:+((Date.now()-t0)/60000).toFixed(1),nodes};
const file=arg('out',path.resolve(__dirname,'../../public/poker-gto/preflop-hu.json'));fs.writeFileSync(file,JSON.stringify(out));console.log('saved',file,nodes.length,'decisions');
