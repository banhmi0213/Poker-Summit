import {publicAction,type ActionPlayer} from './action-feedback';
/** Minimal display markers only: never retain hole cards, identities or credentials. */
import type {PlayerSnapshot} from './player-client';
import {boardSound,type PokerSound} from './online-sounds';
export type SoundMarker={handId:string;revision:number;board:number;actor:string|null;result:boolean;you:number|null;players?:ActionPlayer[]};
export function onlineSoundEvents(previous:SoundMarker|null,state:PlayerSnapshot|null):{marker:SoundMarker|null;sounds:PokerSound[];cue?:ReturnType<typeof publicAction>}{
 const h=state?.hand;if(!state)return {marker:null,sounds:[]};
 if(!h)return {marker:{handId:'',revision:0,board:0,actor:null,result:false,you:state.youSeat},sounds:[]};
 const marker={handId:h.handId,revision:h.revision,board:h.board.length,actor:h.toAct,result:Boolean(h.result),you:state.youSeat,players:h.players?.map(p=>({id:p.id,committed:p.committed,totalCommitted:p.totalCommitted,folded:p.folded,allIn:p.allIn}))};
 const sounds:PokerSound[]=[];
 const cue=previous&&previous.handId===marker.handId&&marker.revision===previous.revision+1?publicAction(previous.players,marker.players,previous.actor):null;
 // First projection/reconnect is a baseline; never replay a historical win or deal.
 if(previous){
  if(previous.handId!==marker.handId)sounds.push('deal');
  else if(marker.board>previous.board)sounds.push(boardSound(marker.board)??'deal');
  if(marker.handId===previous.handId&&marker.revision!==previous.revision&&previous.actor!==null)sounds.push(cue?.kind??'action');
  if(marker.result&&!previous.result&&previous.handId===marker.handId)sounds.push('win');
  if(marker.you!==null&&marker.actor===`seat-${marker.you}`&&!marker.result&&(marker.actor!==previous.actor||marker.revision!==previous.revision||marker.handId!==previous.handId))sounds.push('turn');
 }
 return {marker,sounds,cue};
}
