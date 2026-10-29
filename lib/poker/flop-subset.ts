/** Flop textures: every flop up to suit symmetry (1,755 kinds), a distance between textures, and lookup of the
 * nearest precomputed flop. Flops are written like "Kh7d2c" (rank + suit c/d/h/s). */
const RANKS='23456789TJQKA',SUITS='cdhs';
export type FlopTexture={key:string;ranks:[number,number,number];pairing:0|1|2;pattern:'r'|'hm'|'hl'|'ml'|'m';weight:number};

/** Parse "Kh7d2c" into [rank 2-14, suit 0-3] cards, or null when invalid / repeated. */
export function parseFlop(text:string):[number,number][]|null{
 if(!/^([2-9TJQKA][cdhs]){3}$/i.test(text))return null;
 const cards=[0,2,4].map(i=>[RANKS.indexOf(text[i].toUpperCase())+2,SUITS.indexOf(text[i+1].toLowerCase())] as [number,number]);
 return new Set(cards.map(c=>c.join())).size===3?cards:null;
}
/** Texture of a flop: ranks high to low, pairing (0 none, 1 pair, 2 trips) and which cards share a suit. */
export function texture(text:string):FlopTexture|null{
 const cards=parseFlop(text);if(!cards)return null;
 cards.sort((a,b)=>b[0]-a[0]||a[1]-b[1]);
 const [h,m,l]=cards,ranks:[number,number,number]=[h[0],m[0],l[0]];
 const pairing=(ranks[0]===ranks[2]?2:ranks[0]===ranks[1]||ranks[1]===ranks[2]?1:0) as 0|1|2;
 const same=(a:[number,number],b:[number,number])=>a[1]===b[1];
 let pattern:FlopTexture['pattern']=same(h,m)&&same(m,l)?'m':same(h,m)?'hm':same(h,l)?'hl':same(m,l)?'ml':'r';
 // On a paired board the two equal ranks are interchangeable: name the suited pair member consistently.
 if(pairing===1&&ranks[0]===ranks[1]&&pattern==='ml')pattern='hl';
 if(pairing===1&&ranks[1]===ranks[2]&&pattern==='hl')pattern='hm';
 const key=`${ranks.join('-')}:${pattern}`;
 return {key,ranks,pairing,pattern,weight:0};
}
/** Smaller = more alike. Suit pattern and pairing change strategy most, then the high card, then the rest. */
export function distance(a:FlopTexture,b:FlopTexture){
 const suit=a.pattern===b.pattern?0:(a.pattern==='m'||b.pattern==='m')?6:(a.pattern==='r'||b.pattern==='r')?3:1.5;
 const pair=a.pairing===b.pairing?0:5;
 const gap=(t:FlopTexture)=>Math.min(t.ranks[0]-t.ranks[2],6);
 return suit+pair+1.2*Math.abs(a.ranks[0]-b.ranks[0])+0.8*Math.abs(a.ranks[1]-b.ranks[1])+0.6*Math.abs(a.ranks[2]-b.ranks[2])+0.4*Math.abs(gap(a)-gap(b));
}
/** All 1,755 flop kinds with how many of the 22,100 real flops each one stands for. */
export function allTextures():(FlopTexture&{example:string})[]{
 const map=new Map<string,FlopTexture&{example:string}>();
 const card=(c:number)=>RANKS[c>>2]+SUITS[c&3];
 for(let a=0;a<52;a++)for(let b=a+1;b<52;b++)for(let c=b+1;c<52;c++){
  const text=card(c)+card(b)+card(a),t=texture(text)!;const e=map.get(t.key);
  if(e)e.weight++;else map.set(t.key,{...t,weight:1,example:canonicalFlop(text)??text});
 }
 return [...map.values()];
}
/** A fixed spelling for a texture: high to low, suits h/d/c with the suited cards sharing h. */
export function canonicalFlop(text:string){
 const t=texture(text);if(!t)return null;const [h,m,l]=t.ranks.map(r=>RANKS[r-2]);
 const suits={r:['h','d','c'],hm:['h','h','c'],hl:['h','d','h'],ml:['h','d','d'],m:['h','h','h']}[t.pattern];
 return h+suits[0]+m+suits[1]+l+suits[2];
}
/** The precomputed flop closest to any flop the player types. */
export function nearestFlop(text:string,computed:readonly string[]){
 const t=texture(text);if(!t)return null;let best:string|null=null,bestD=Infinity;
 for(const f of computed){const u=texture(f);if(!u)continue;const d=distance(t,u);if(d<bestD){bestD=d;best=f;}}
 return best===null?null:{flop:best,distance:bestD,exact:bestD===0};
}
