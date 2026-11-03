/** What a hand has made on the board, for the range view (2026/10/29: 役の強さごとの打ち方).
 * Cards are codes 0..51: rank = (code>>2)+2 (2..14), suit = code&3. Only categories the hole cards take part in count,
 * so a pair on the board alone is ノーペア. */
export const HAND_CATEGORIES=['フルハウス以上','フラッシュ','ストレート','セット・スリーカード','ツーペア','オーバーペア','トップペア','ミドルペア','ロウペア','フラッシュドロー','両面ストレートドロー','ガットショット','ノーペア'] as const;
export type HandCategory=typeof HAND_CATEGORIES[number];

const rankOf=(c:number)=>(c>>2)+2,suitOf=(c:number)=>c&3;
function straightWith(ranks:Set<number>,need:number,hole:readonly number[]):boolean{
 const has=(r:number)=>ranks.has(r)||(r===1&&ranks.has(14));
 for(let lo=1;lo<=10;lo++){let n=0,usesHole=false;for(let r=lo;r<lo+5;r++)if(has(r)){n++;if(hole.some(h=>h===r||(r===1&&h===14)))usesHole=true;}
  if(n>=need&&usesHole)return true;}
 return false;
}
/** Four ranks in a row, using a hole card, that a card on either end completes (A-2-3-4 and J-Q-K-A have one end only). */
function openEnded(ranks:Set<number>,hole:readonly number[]):boolean{
 for(let lo=2;lo<=10;lo++){let ok=true,usesHole=false;for(let r=lo;r<lo+4;r++){if(!ranks.has(r)){ok=false;break;}if(hole.includes(r))usesHole=true;}
  if(ok&&usesHole&&lo+3<=13)return true;}
 return false;
}
export function handCategory(hole:readonly [number,number],board:readonly number[]):HandCategory{
 const all=[...hole,...board],cnt=new Map<number,number>();for(const c of all)cnt.set(rankOf(c),(cnt.get(rankOf(c))??0)+1);
 const h=hole.map(rankOf),b=board.map(rankOf),boardDesc=[...new Set(b)].sort((x,y)=>y-x);
 const suits=[0,0,0,0];for(const c of all)suits[suitOf(c)]++;
 const flushSuit=suits.findIndex(n=>n>=5),flush=flushSuit>=0&&hole.some(c=>suitOf(c)===flushSuit);
 const ranks=new Set(all.map(rankOf));
 const holeTrips=h.some(r=>(cnt.get(r)??0)>=3),holeQuads=h.some(r=>(cnt.get(r)??0)>=4);
 const pairsOther=[...cnt.entries()].filter(([,n])=>n>=2);
 if(h[0]===h[1]&&[...cnt.entries()].some(([r,n])=>r!==h[0]&&n>=3))return 'フルハウス以上';
 if(holeQuads||(holeTrips&&pairsOther.length>=2)||(h[0]!==h[1]&&(cnt.get(h[0])??0)>=2&&(cnt.get(h[1])??0)>=2&&pairsOther.some(([,n])=>n>=3)))return 'フルハウス以上';
 if(flush)return 'フラッシュ';
 if(straightWith(ranks,5,h))return 'ストレート';
 if(holeTrips)return 'セット・スリーカード';
 const onBoard=(r:number)=>b.includes(r);
 if(h[0]!==h[1]&&onBoard(h[0])&&onBoard(h[1]))return 'ツーペア';
 if(h[0]===h[1]){const r=h[0];if(r>boardDesc[0])return 'オーバーペア';if(boardDesc.length>1&&r>boardDesc[1])return 'ミドルペア';return 'ロウペア';}
 const paired=h.filter(onBoard).sort((x,y)=>y-x)[0];
 if(paired!==undefined){if(paired===boardDesc[0])return 'トップペア';if(paired===boardDesc[1])return 'ミドルペア';return 'ロウペア';}
 if(board.length<5){
  if(suits.some((n,s)=>n===4&&hole.some(c=>suitOf(c)===s)))return 'フラッシュドロー';
  if(openEnded(ranks,h))return '両面ストレートドロー';
  if(straightWith(ranks,4,h))return 'ガットショット';
 }
 return 'ノーペア';
}

/** Every combo of a hand class ("AKs", "QJo", "77") that does not use a board card. */
export function combosOfClass(cls:string,board:readonly number[]):[number,number][]{
 const R='23456789TJQKA',r1=R.indexOf(cls[0])+2,r2=R.indexOf(cls[1])+2,used=new Set(board),out:[number,number][]=[];
 const code=(r:number,s:number)=>(r-2)*4+s;
 for(let s1=0;s1<4;s1++)for(let s2=0;s2<4;s2++){
  if(r1===r2&&s2<=s1)continue;
  if(cls[2]==='s'&&s1!==s2)continue;if(cls[2]==='o'&&s1===s2)continue;
  const a=code(r1,s1),c=code(r2,s2);if(used.has(a)||used.has(c))continue;out.push([a,c]);
 }
 return out;
}
