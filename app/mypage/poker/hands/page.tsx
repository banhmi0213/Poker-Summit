import {loadHandHistories} from '@/lib/poker/hand-histories';
import {HandHistoryList} from '@/app/poker-ui/hand-history-list';
import {PokerWorkspace} from '@/app/poker-ui/workspace';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:{before?:string}}){
 const hands=await loadHandHistories(false,searchParams.before);
 const more=hands&&hands.length===20?`/mypage/poker/hands?before=${encodeURIComponent(hands[hands.length-1].playedAt)}`:null;
 return <PokerWorkspace kind="account" panes={[{id:'hands',label:'ハンド履歴',eyebrow:'HAND HISTORY',description:'プレイしたハンドを1つずつ再生して振り返る。',
  content:hands?<><HandHistoryList hands={hands} base="/mypage/poker/hands" moreHref={more}/><p><a href="/mypage/poker">マイページに戻る</a></p></>:<p>ハンド履歴を取得できません。<a href="/login">ログイン状態</a>をご確認ください。</p>}]}/>;
}
