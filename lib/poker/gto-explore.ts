/** Turn and river from the flop page (2026/10/30): after a flop line that closes the betting (check-check or a call),
 * pick a turn card and solve the turn and river right here. The ranges are the file's preflop-chart ranges, narrowed
 * by the flop strategy along the chosen line (exact suit rows where the file has them); pot and stacks come from the
 * same bet tree the flop file was solved with. One solve covers the turn and every river card. */
import {PostflopSolver,buildTree,type Combo,type Node} from './postflop-solver';
import {describe,classOf,type SolverView,type ViewStep} from './solver-view';
import {flopRow} from './gto-bot';
import type {FlopData,FlopNode,FlopSizes} from './gto-spots';

const RANKS='23456789TJQKA',SUITS='cdhs';
const code=(s:string)=>RANKS.indexOf(s[0].toUpperCase())*4+SUITS.indexOf(s[1].toLowerCase());
export type ExploreSpot={pot:number;stack:number;board:number[];reach:[number,number];sizes:FlopSizes};
export type ExploreResult={view:SolverView;spot:Omit<ExploreSpot,'sizes'>;iterations:number}|{error:string};

/** Where the flop line ends: pot and stack for the turn, or why it can't be explored. */
export function turnStart(file:FlopData,path:readonly number[]):{pot:number;stack:number}|{error:string}{
 const sizes=file.spot.sizes;if(!sizes||file.spot.order)return {error:'このデータではターンの計算ができません。'};
 let node:Node=buildTree({maxRaises:1,turnMaxRaises:1,riverMaxRaises:1,...sizes,pot:file.spot.pot,stack:file.spot.stack} as never,'flop');
 for(const i of path){if(node.kind!=='act'||i>=node.children.length)return {error:'フロップの流れが見つかりません。'};node=node.children[i];}
 if(node.kind!=='chance'||node.street!=='turn')return {error:'フロップの打ち合いが終わっていません。'};
 const c=node.contrib;if(c[0]!==c[1])return {error:'フロップの打ち合いが終わっていません。'};
 if(c[0]>=file.spot.stack)return {error:'オールインが入っているので、ターン以降の打ち合いはありません。'};
 return {pot:file.spot.pot+c[0]+c[1],stack:file.spot.stack-c[0]};
}

/** Ranges at the turn: chart ranges narrowed by each player's flop actions along `path`. */
export function turnRanges(file:FlopData,path:readonly number[]):[Combo[],Combo[]]|null{
 const chart=(file.spot as {chartRanges?:{oop:Record<string,number>;ip:Record<string,number>}}).chartRanges;if(!chart)return null;
 const board=file.board;
 const side=(w:Record<string,number>)=>{const out:Combo[]=[];for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){if(board.includes(a)||board.includes(b))continue;const x=w[classOf(a,b)];if(x)out.push({c1:a,c2:b,weight:x});}return out;};
 const ranges:[Combo[],Combo[]]=[side(chart.oop),side(chart.ip)];
 let idx:number|null=0;
 for(const step of path){
  const node:FlopNode|undefined=idx===null?undefined:file.nodes[idx];if(!node)return null;
  for(const c of ranges[node.player]){const row=flopRow(node,c.c1,c.c2,board)??node.classes[classOf(c.c1,c.c2)];c.weight*=row?row[1+step]??0:0;}
  idx=node.children[step];
 }
 return [ranges[0].filter(c=>c.weight>1e-6),ranges[1].filter(c=>c.weight>1e-6)];
}

const solves=new Map<string,PostflopSolver>();
/** Solve (or reuse) the turn after `path` with `turn`, then describe the decision reached by `steps` (turn actions,
 * a river card code at the river deal, river actions). */
export function exploreTurn(file:FlopData,path:readonly number[],turn:string,steps:ViewStep[],budgetMs=6000):ExploreResult{
 const start=turnStart(file,path);if('error' in start)return start;
 const t=code(turn);if(t<0||file.board.includes(t))return {error:'そのカードはボードに出ています。'};
 const key=`${file.spot.id}|${file.flop}|${path.join('.')}|${t}`;let solver=solves.get(key);
 if(!solver){
  const ranges=turnRanges(file,path);if(!ranges)return {error:'このデータにはレンジが入っていないため、ターンの計算ができません。'};
  const s=file.spot.sizes!,r:[Combo[],Combo[]]=[ranges[0].filter(c=>c.c1!==t&&c.c2!==t),ranges[1].filter(c=>c.c1!==t&&c.c2!==t)];
  if(!r[0].length||!r[1].length)return {error:'この流れでは、どちらかのレンジに残る手がありません。'};
  solver=new PostflopSolver({board:[...file.board,t],pot:start.pot,stack:start.stack,ranges:r,
   betSizes:s.turnBetSizes??s.betSizes,raiseSizes:s.turnRaiseSizes??s.raiseSizes,maxRaises:1,riverBetSizes:s.riverBetSizes??s.betSizes,riverRaiseSizes:s.riverRaiseSizes??s.raiseSizes,riverMaxRaises:1,allinMaxPot:s.allinMaxPot??1.5});
  const t0=Date.now();while(Date.now()-t0<budgetMs&&solver.iterations<400)solver.run(1);
  solves.set(key,solver);while(solves.size>2)solves.delete(solves.keys().next().value as string);
 }
 const reach:[number,number]=[solver.sides[0].n,solver.sides[1].n];
 return {view:describe(solver,steps),spot:{pot:start.pot,stack:start.stack,board:[...file.board,t],reach},iterations:solver.iterations};
}
