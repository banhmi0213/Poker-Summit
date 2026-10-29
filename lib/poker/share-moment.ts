/** 「このハンドを共有する？」 (owner 2026/10/27): after a memorable ring hand, offer to post it to the board.
 * Big win (30BB or more), an all-in lost at showdown, or a full house or better shown at showdown. */
import {madeHandLabel} from './card-display';
import type {RingPlayView} from './ring-play-state';
export type ShareMoment={handId:string;reason:'big'|'badbeat'|'monster';text:string};
export const SHARE_PROMPT_GAP_MS=30*60*1000,SHARE_PROMPT_SHOW_MS=10000;
const MONSTER=['フルハウス','フォーカード','ストレートフラッシュ','ロイヤルフラッシュ'];
export function shareMoment(play:RingPlayView|null|undefined):ShareMoment|null{
 const s=play?.hand;if(!play||!s||!s.result||play.spectating)return null;
 const me=s.players.find(p=>p.id===play.viewerSeat);if(!me)return null;
 const net=(s.result.payouts[me.id]??0)-me.totalCommitted,bb=s.terms.bb;
 if(s.result.showdown&&s.board.length===5){
  const shown=s.players.filter(p=>p.hole&&!p.folded).map(p=>madeHandLabel(p.hole,s.board)??'');
  if(shown.some(l=>MONSTER.some(m=>l.startsWith(m))))return {handId:s.handId,reason:'monster',text:'すごい役が出たハンドです'};
  if(me.allIn&&net<0)return {handId:s.handId,reason:'badbeat',text:'オールインで惜しくも負けたハンドです'};
 }
 if(bb>0&&net>=30*bb)return {handId:s.handId,reason:'big',text:'大きいポットを取ったハンドです'};
 return null;
}
