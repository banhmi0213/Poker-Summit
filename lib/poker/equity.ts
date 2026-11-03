/** Practice/review helper (2026/10/26): Monte Carlo equity and pot odds.
 * Uses the same seven-card evaluator as settlement. Opponents are assumed to hold RANDOM hands,
 * so the result is a teaching estimate, not a GTO solution (real ranges after a raise are stronger).
 * Never run this for live opponents' hidden cards on the server; it only takes cards the viewer may see.
 */
import {bestOfSeven,compareScores,createDeck,type Card} from './engine';

const key=(c:Card)=>c.rank+c.suit;
export type EquityResult={equity:number;win:number;tie:number;iterations:number};

/** Hero's share of the pot against `opponents` random hands, averaged over random run-outs. */
export function estimateEquity(hero:readonly Card[],board:readonly Card[],opponents:number,iterations=1500,random:()=>number=Math.random):EquityResult{
 if(hero.length!==2||board.length>5||![0,3,4,5].includes(board.length))throw new Error('Invalid cards');
 if(!Number.isInteger(opponents)||opponents<1||opponents>8)throw new Error('Invalid opponent count');
 if(!Number.isInteger(iterations)||iterations<1||iterations>20000)throw new Error('Invalid iterations');
 const used=new Set([...hero,...board].map(key));
 if(used.size!==hero.length+board.length)throw new Error('Duplicate cards');
 const rest=createDeck().filter(c=>!used.has(key(c)));
 let share=0,win=0,tie=0;
 const need=opponents*2+(5-board.length);
 for(let i=0;i<iterations;i++){
  // Partial Fisher-Yates: only the cards this trial needs.
  const deck=rest.slice();
  for(let j=0;j<need;j++){const k=j+Math.floor(random()*(deck.length-j));[deck[j],deck[k]]=[deck[k],deck[j]];}
  const runout=[...board,...deck.slice(opponents*2,need)];
  const mine=bestOfSeven([...hero,...runout]);
  let ties=0,lost=false;
  for(let o=0;o<opponents;o++){
   const cmp=compareScores(bestOfSeven([deck[o*2],deck[o*2+1],...runout]),mine);
   if(cmp>0){lost=true;break;}
   if(cmp===0)ties++;
  }
  if(lost)continue;
  if(ties===0){win++;share+=1;}else{tie++;share+=1/(ties+1);}
 }
 return {equity:share/iterations,win:win/iterations,tie:tie/iterations,iterations};
}

/** Share of the final pot you must win for a call to break even: toCall / (pot + toCall). */
export function requiredEquity(toCall:number,pot:number){
 if(!(toCall>0)||!(pot>=0))return 0;
 return toCall/(pot+toCall);
}

export type DecisionNote='call-ok'|'call-thin'|'fold-strong'|'fold-ok'|null;
/** Plain-language flag for one facing-a-bet decision. Margin keeps borderline spots unflagged. */
export function judgeDecision(action:'fold'|'call'|'raise'|'check'|'bet',equity:number,required:number,margin=0.05):DecisionNote{
 if(required<=0)return null;
 if(action==='fold')return equity>required+margin?'fold-strong':'fold-ok';
 if(action==='call')return equity+margin<required?'call-thin':'call-ok';
 return null;
}
