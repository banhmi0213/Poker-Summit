/** Display adapter only: preserves the server hand, amounts and private projection. */
import type {RingPlayView} from './ring-play-state';
import type {PlayerSnapshot} from './player-client';
export function ringTableDisplay(play:RingPlayView,now:number):PlayerSnapshot {
 const h=play.hand,period={kind:'level' as const,minutes:1,sb:h.terms.sb,bb:h.terms.bb,ante:0,note:''};
 return {revision:h.revision,mode:'single-hand',phase:h.result?'complete':'playing',handNumber:0,
  completedAt:null,tournament:null,youSeat:Number(play.viewerSeat.slice(5)),timeBank:{seconds:0,remaining:0},
  turnDurationMs:30000,turn:h.toAct&&play.deadline!==null?{handId:h.handId,revision:h.revision,actor:h.toAct,expiresAt:play.deadline}:null,
  seats:Array.from({length:6},(_,i)=>({seat:i+1,id:'seat-'+(i+1),occupied:h.players.some(p=>p.id==='seat-'+(i+1)),connected:false})),
  hand:h,autoExitAt:null,runout:null,serverNow:now,startsAt:'',
  structure:{startingStack:0,anteType:'none',lateRegLevel:1,reentry:false,periods:[period]},
  clock:{phase:'final',index:0,level:0,period,next:null,following:null,remaining:0,registrationOpen:false},canStartHand:false};
}
