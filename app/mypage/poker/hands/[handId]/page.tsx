import {loadHandHistory} from '@/lib/poker/hand-histories';
import {HandReplay} from '@/app/poker-ui/hand-replay';
import {PokerWorkspace} from '@/app/poker-ui/workspace';
import {ShareToBoard} from '@/app/poker-ui/share-to-board';
import {cardLabel} from '@/lib/poker/card-display';
export const dynamic='force-dynamic';
/** e.g. 「ハンド相談：BTN A♠K♠（1/2）」 */
function shareTitle(hand:NonNullable<Awaited<ReturnType<typeof loadHandHistory>>>){const me=hand.players.find(p=>p.you);return `ハンド相談：${me?`${me.position} ${(me.hole??[]).map(cardLabel).join('')}`:''}（${hand.terms.sb}/${hand.terms.bb}）`.slice(0,100);}
export default async function Page({params}:{params:{handId:string}}){
 const hand=await loadHandHistory(params.handId);
 return <PokerWorkspace kind="account" panes={[{id:'replay',label:'ハンドを再生',eyebrow:'HAND REPLAY',description:'自分の手札と、ショーダウンで公開された手札だけが表示されます。',
  content:<>{hand?<><HandReplay hand={hand}/><ShareToBoard handId={hand.handId} defaultTitle={shareTitle(hand)}/></>:<p>このハンドは表示できません。参加したハンドのみ確認できます。</p>}<p><a href="/mypage/poker/hands">ハンド履歴に戻る</a></p></>}]}/>;
}
