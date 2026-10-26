import {loadPokerStatistics} from '@/lib/poker/statistics';
import {StatisticsView} from '@/app/poker-tournaments/statistics-view';
import {PokerWorkspace} from '@/app/poker-ui/workspace';
import {loadHandHistories} from '@/lib/poker/hand-histories';
import {HandHistoryList} from '@/app/poker-ui/hand-history-list';
export const dynamic='force-dynamic';
export default async function Page(){const [data,hands]=await Promise.all([loadPokerStatistics(),loadHandHistories()]);
 const unavailable=<p>成績を取得できません。<a href="/login">ログイン状態</a>をご確認ください。</p>;
 return <PokerWorkspace kind="account" panes={[
 {id:'ring',label:'チップ残高・順位',eyebrow:'RING CHIP BALANCE',description:'リング用チップの残高と自分のランキング。',content:data?<StatisticsView data={data} section="ring"/>:unavailable},
 {id:'summary',label:'通算成績',eyebrow:'PLAYER RECORD',description:'終了・確定した大会の成績を振り返る。',content:data?<StatisticsView data={data} section="summary"/>:unavailable},
 {id:'upcoming',label:'参加予定の大会',eyebrow:'YOUR NEXT TOURNAMENT',description:'登録済み・進行中の大会と参加卓を確認。',content:data?<StatisticsView data={data} section="upcoming"/>:unavailable},
 {id:'history',label:'参加大会の履歴',eyebrow:'TOURNAMENT HISTORY',description:'これまでの大会と最終順位。',content:data?<StatisticsView data={data} section="history"/>:unavailable},
 {id:'hands',label:'ハンド履歴',eyebrow:'HAND HISTORY',description:'プレイしたハンドを1つずつ再生して振り返る。',content:hands?<HandHistoryList hands={hands} base="/mypage/poker/hands" moreHref={hands.length===20?`/mypage/poker/hands?before=${encodeURIComponent(hands[hands.length-1].playedAt)}`:null}/>:unavailable},
 ]}/>;
}
