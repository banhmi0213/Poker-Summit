import {canonicalFlop,nearestFlop} from './flop-subset';
const display=(f:string)=>f.replace(/([2-9TJQKA])([cdhs])/g,(_,r:string,s:string)=>r+({c:'♣',d:'♦',h:'♥',s:'♠'}[s]??s));
/** Resolve against this spot's complete index, including batches beyond the initial representatives. */
export function resolveFlopSelection(requested:string,computed:readonly string[]){
 if(!canonicalFlop(requested))return null;
 const pick=nearestFlop(requested,computed);if(!pick)return null;
 return {...pick,note:pick.exact?'計算済みのフロップの答えを表示しています。':`${display(requested)} は未計算のため、一番近い計算済みのフロップ ${display(pick.flop)} の答えを表示しています。`};
}
