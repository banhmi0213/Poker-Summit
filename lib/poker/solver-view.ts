/** Read a solved spot for display: walk a path of actions (and river cards under a turn solve),
 * tracking each player's reach, and summarise the acting player's strategy per starting-hand class. */
import {dealCard,NO_CARDS,type PostflopSolver,type Node,type ActNode} from './postflop-solver';

const RANKS='23456789TJQKA';
export function classOf(a:number,b:number){const [x,y]=a>b?[a,b]:[b,a];const ra=RANKS[x>>2],rb=RANKS[y>>2];return x>>2===y>>2?ra+rb:ra+rb+((x&3)===(y&3)?'s':'o');}
export const cardText=(c:number)=>RANKS[c>>2]+'♣♦♥♠'[c&3];

/** A path step: an action index at a decision, or a card code at a turn/river deal. */
export type ViewStep=number;
export type SolverView={
 trail:string[];
 /** 'act' = someone to act; 'chance' = choose the river card; 'end' = the hand is over on this line. */
 kind:'act'|'chance'|'end';
 street?:'flop'|'turn'|'river';player?:0|1;
 /** At a deal: which card is being dealt. */
 deal?:'turn'|'river';
 actions?:{label:string;kind:string;next:boolean}[];
 /** Starting-hand class -> [reach weight, ...share of each action]. */
 classes?:Record<string,number[]>;
 total?:number[];
 cards?:number[];
};

export function describe(solver:PostflopSolver,steps:ViewStep[]):SolverView{
 let node:Node=solver.tree,ctx=NO_CARDS;const trail:string[]=[];
 const reach=[Float64Array.from(solver.sides[0].w),Float64Array.from(solver.sides[1].w)];
 for(const step of steps){
  if(node.kind==='chance'){
   if(!solver.dealable(ctx).includes(step))break;
   ctx=dealCard(ctx,step);for(const p of [0,1] as const)for(const h of solver.sides[p].byCard[step])reach[p][h]=0;
   trail.push(`${node.street==='turn'?'ターン':'リバー'} ${cardText(step)}`);node=node.child;continue;
  }
  if(node.kind!=='act'||step<0||step>=node.actions.length)break;
  const st=solver.strategy(node,true,ctx),k=node.actions.length,r=reach[node.player];
  for(let h=0;h<r.length;h++)r[h]*=st[h*k+step];
  trail.push(`${node.player===0?'OOP':'IP'} ${node.actions[step].label}`);node=node.children[step];
 }
 if(node.kind==='chance')return {trail,kind:'chance',deal:node.street,cards:solver.dealable(ctx)};
 if(node.kind!=='act')return {trail,kind:'end'};
 const act:ActNode=node,side=solver.sides[act.player],st=solver.strategy(act,true,ctx),k=act.actions.length,r=reach[act.player];
 const classes:Record<string,number[]>={},total=new Array(k).fill(0);let tw=0;
 for(let h=0;h<side.n;h++){if(r[h]<=1e-12)continue;const l=classOf(side.c1[h],side.c2[h]);const e=classes[l]??=new Array(k+1).fill(0);e[0]+=r[h];
  for(let a=0;a<k;a++){e[a+1]+=r[h]*st[h*k+a];total[a]+=r[h]*st[h*k+a];}tw+=r[h];}
 for(const e of Object.values(classes))for(let a=1;a<=k;a++)e[a]/=e[0];
 return {trail,kind:'act',street:act.street,player:act.player,
  actions:act.actions.map((a,i)=>({label:a.label,kind:a.kind,next:act.children[i].kind==='act'||act.children[i].kind==='chance'&&(act.children[i] as {child:Node}).child.kind==='act'})),
  classes,total:total.map(v=>tw?v/tw:0)};
}
