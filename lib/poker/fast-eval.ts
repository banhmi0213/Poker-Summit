/** Fast 7-card evaluator for offline solving and practice tools (2026/10/26).
 * Returns one integer per hand; larger is better and equal means a tie. It must order hands exactly
 * like engine.ts bestOfSeven (verified by tests); settlement keeps using engine.ts.
 * Card code = (rank-2)*4 + suit index (c,d,h,s), 0..51.
 */
import type {Card} from './engine';
const suitIndex={c:0,d:1,h:2,s:3} as const;
export const cardCode=(c:Card)=>(c.rank-2)*4+suitIndex[c.suit];

// Highest straight top (rank index 0..12, 3 = five-high wheel) in a 13-bit mask, or -1.
function straightTop(mask:number){
 for(let top=12;top>=3;top--){
  const need=top===3?(0b1111|(1<<12)):(0b11111<<(top-4));
  if((mask&need)===need)return top;
 }
 return -1;
}
const pack=(cat:number,k:number[])=>{let v=cat;for(let i=0;i<5;i++)v=v*13+(k[i]??0);return v;};
function topBits(mask:number,n:number,skip=-1){const out:number[]=[];for(let r=12;r>=0&&out.length<n;r--)if(r!==skip&&(mask>>r)&1)out.push(r);return out;}

/** cards: 5..7 card codes. */
export function evalCodes(cards:readonly number[]):number{
 const suitMask=[0,0,0,0],counts=new Array(13).fill(0);let all=0;
 for(const c of cards){const r=c>>2,s=c&3;suitMask[s]|=1<<r;counts[r]++;all|=1<<r;}
 for(let s=0;s<4;s++){
  let n=0;for(let m=suitMask[s];m;m&=m-1)n++;
  if(n>=5){const sf=straightTop(suitMask[s]);if(sf>=0)return pack(8,[sf]);
   // A flush: compare quads/full house first (they beat a flush).
   const q=counts.lastIndexOf(4);if(q>=0)return pack(7,[q,...topBits(all,1,q)]);
   const trips=[...counts.keys()].filter(r=>counts[r]===3).reverse(),pairs=[...counts.keys()].filter(r=>counts[r]===2).reverse();
   if(trips.length&&(trips.length>1||pairs.length))return pack(6,[trips[0],trips.length>1?Math.max(trips[1],pairs[0]??-1):pairs[0]]);
   return pack(5,topBits(suitMask[s],5));}
 }
 const quad=counts.lastIndexOf(4);if(quad>=0)return pack(7,[quad,...topBits(all,1,quad)]);
 const trips:number[]=[],pairs:number[]=[];for(let r=12;r>=0;r--){if(counts[r]===3)trips.push(r);else if(counts[r]===2)pairs.push(r);}
 if(trips.length&&(trips.length>1||pairs.length))return pack(6,[trips[0],trips.length>1?Math.max(trips[1],pairs[0]??-1):pairs[0]]);
 const st=straightTop(all);if(st>=0)return pack(4,[st]);
 if(trips.length){const k=topBits(all&~(1<<trips[0]),2);return pack(3,[trips[0],...k]);}
 if(pairs.length>=2){const k=topBits(all&~(1<<pairs[0])&~(1<<pairs[1]),1);return pack(2,[pairs[0],pairs[1],...k]);}
 if(pairs.length===1){return pack(1,[pairs[0],...topBits(all&~(1<<pairs[0]),3)]);}
 return pack(0,topBits(all,5));
}
export const evalCards=(cards:readonly Card[])=>evalCodes(cards.map(cardCode));
