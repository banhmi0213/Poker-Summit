/** Presentation events contain public IDs/counts only, never cards or credentials. */
export type TableMotionFrame={handId:string;revision:number;boardCount:number;settled:boolean;players:{id:string;committed:number;totalCommitted:number;folded:boolean}[]};
export type TableMotionEvent={kind:'deal'|'bet'|'collect'|'fold'|'board';player?:string;index?:number;amount?:number;delay?:number};
export function tableMotionEvents(previous:TableMotionFrame|null,next:TableMotionFrame|null):TableMotionEvent[]{
 if(!next)return [];
 const fresh=!previous||previous.handId!==next.handId,events:TableMotionEvent[]=[];
 if(fresh){
  // Rejoining an existing hand must not pretend to redeal or repeat old bets.
  if(next.revision!==0||next.boardCount!==0||next.settled)return [];
  for(let card=0;card<2;card++)next.players.filter(p=>!p.folded).forEach((p,i)=>events.push({kind:'deal',player:p.id,index:card,delay:(card*next.players.length+i)*55}));
  next.players.filter(p=>p.totalCommitted>0).forEach(p=>events.push({kind:'bet',player:p.id,amount:p.totalCommitted,delay:250}));
  return events;
 }
 if(next.revision<previous.revision||next.boardCount<previous.boardCount)return [];
 const advancing=next.boardCount>previous.boardCount;
 for(const p of next.players){const before=previous.players.find(v=>v.id===p.id);if(!before)continue;
  if(!before.folded&&p.folded)events.push({kind:'fold',player:p.id});
  const delta=p.totalCommitted-before.totalCommitted;
  if(delta>0&&!next.settled)events.push({kind:'bet',player:p.id,amount:delta});
  if(advancing&&before.committed>0&&!next.settled)events.push({kind:'collect',player:p.id,amount:before.committed,delay:delta>0?390:0});
 }
 for(let i=previous.boardCount;i<next.boardCount;i++)events.push({kind:'board',index:i,delay:(i-previous.boardCount)*95});
 return events;
}
