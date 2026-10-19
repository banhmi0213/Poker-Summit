/** Minimal display markers only: never retain hole cards, identities or credentials. */
import type {PlayerSnapshot} from './player-client';
import type {PokerSound} from './online-sounds';
export type SoundMarker={handId:string;revision:number;board:number;actor:string|null;result:boolean;you:number|null};
export function onlineSoundEvents(previous:SoundMarker|null,state:PlayerSnapshot|null):{marker:SoundMarker|null;sounds:PokerSound[]}{
 const h=state?.hand;if(!state)return {marker:null,sounds:[]};
 if(!h)return {marker:{handId:'',revision:0,board:0,actor:null,result:false,you:state.youSeat},sounds:[]};
 const marker={handId:h.handId,revision:h.revision,board:h.board.length,actor:h.toAct,result:Boolean(h.result),you:state.youSeat};
 const sounds:PokerSound[]=[];
 // First projection/reconnect is a baseline; never replay a historical win or deal.
 if(previous){
  if(previous.handId!==marker.handId||marker.board>previous.board)sounds.push('deal');
  else if(marker.handId===previous.handId&&marker.revision!==previous.revision&&!marker.result)sounds.push('action');
  if(marker.result&&!previous.result&&previous.handId===marker.handId)sounds.push('win');
  if(marker.you!==null&&marker.actor===`seat-${marker.you}`&&!marker.result&&(marker.actor!==previous.actor||marker.revision!==previous.revision||marker.handId!==previous.handId))sounds.push('turn');
 }
 return {marker,sounds};
}
