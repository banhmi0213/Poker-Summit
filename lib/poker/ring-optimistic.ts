/** Display only: your own move shows the moment you tap it (owner 2026/10/29: 押しても反応せーへんのはごっついストレス).
 * The server stays the judge. This view is used only while the move is in flight; when the server answers, its state
 * replaces this one, and a rejected move simply falls back to the last server state.
 */
import type {RingPlayView} from './ring-play-state';
import type {Command} from './hand-command';

type Hand=RingPlayView['hand'];
type Player=Hand['players'][number];

/** Best guess of who acts next; null when the street (or the hand) closes, which only the server can deal. */
function nextActor(hand:Hand,players:Player[],me:string,aggressive:boolean):string|null{
 const live=players.filter(p=>!p.folded);if(live.length<=1)return null;
 const eligible=live.filter(p=>!p.allIn),top=Math.max(...live.map(p=>p.committed));
 if(eligible.length===0||(eligible.length===1&&eligible[0].committed>=top))return null;
 const index=players.findIndex(p=>p.id===me);
 let next:Player|null=null;
 for(let n=1;n<=players.length;n++){const p=players[(index+n)%players.length];if(!p.folded&&!p.allIn){next=p;break;}}
 if(!next)return null;
 if(aggressive)return next.id;
 const matched=eligible.every(p=>p.committed===top);
 if(!matched)return next.id;
 if(hand.street==='preflop'){
  // Everyone limped: the big blind still has the option unless the big blind just closed it.
  return top===hand.terms.bb&&next.id===hand.positions.bb&&me!==hand.positions.bb?next.id:null;
 }
 // A bet that everyone matched closes the street; all checks close it once the last player in turn order checks.
 if(top>0)return null;
 const first=players.findIndex(p=>p.id===hand.positions.postflopFirst),rank=(id:string)=>(players.findIndex(p=>p.id===id)-first+players.length)%players.length;
 return rank(next.id)>rank(me)?next.id:null;
}

/** Same inputs give the same object, so React effects keyed on the play do not rerun on every render. */
const memo=new WeakMap<RingPlayView,{command:Command;view:RingPlayView}>();
export function optimisticRingPlay(play:RingPlayView,command:Command|null|undefined):RingPlayView{
 if(!command)return play;
 const hit=memo.get(play);if(hit&&hit.command===command)return hit.view;
 const view=project(play,command);memo.set(play,{command,view});return view;
}
function project(play:RingPlayView,command:Command):RingPlayView{
 const hand=play.hand,me=play.viewerSeat;
 if(!command||play.spectating||hand.result||command.handId!==hand.handId||command.revision!==hand.revision)return play;
 const action=command.action;
 if(action.type==='runs'){
  if(!hand.runs||!hand.runs.canChoose)return play;
  return {...play,hand:{...hand,runs:{...hand.runs,canChoose:false,choices:{...hand.runs.choices,[me]:action.count}}}};
 }
 const legal=hand.legal;if(hand.toAct!==me||!legal)return play;
 const self=hand.players.find(p=>p.id===me);if(!self)return play;
 let add=0,folded=false;
 if(action.type==='fold')folded=true;
 else if(action.type==='check'){if(!legal.check)return play;}
 else if(action.type==='call'){if(!legal.call)return play;add=legal.callAmount;}
 else{if(!legal.raise||!Number.isSafeInteger(action.amount)||action.amount<legal.minRaiseTo!||action.amount>legal.maxRaiseTo!)return play;add=action.amount-self.committed;}
 if(add<0||add>self.stack)return play;
 const players=hand.players.map(p=>p.id!==me?p:{...p,folded:p.folded||folded,stack:p.stack-add,committed:p.committed+add,totalCommitted:p.totalCommitted+add,allIn:p.allIn||(add>0&&p.stack===add)});
 const toAct=nextActor(hand,players,me,action.type==='bet'||action.type==='raise');
 // No clock while the server confirms: the next player's timer starts from the server's deadline.
 return {...play,deadline:null,hand:{...hand,revision:hand.revision+1,pot:hand.pot+add,players,toAct,legal:null}};
}
