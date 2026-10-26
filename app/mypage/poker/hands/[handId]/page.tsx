import {loadHandHistory} from '@/lib/poker/hand-histories';
import {HandReplay} from '@/app/poker-ui/hand-replay';
import {PokerWorkspace} from '@/app/poker-ui/workspace';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:{handId:string}}){
 const hand=await loadHandHistory(params.handId);
 return <PokerWorkspace kind="account" panes={[{id:'replay',label:'ハンドを再生',eyebrow:'HAND REPLAY',description:'自分の手札と、ショーダウンで公開された手札だけが表示されます。',
  content:<>{hand?<HandReplay hand={hand}/>:<p>このハンドは表示できません。参加したハンドのみ確認できます。</p>}<p><a href="/mypage/poker/hands">ハンド履歴に戻る</a></p></>}]}/>;
}
