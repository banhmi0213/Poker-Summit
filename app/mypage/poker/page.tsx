import {loadPokerStatistics} from '@/lib/poker/statistics';
import {POKER_TOURNAMENTS_ENABLED} from '@/lib/poker/features';
import {StatisticsView} from '@/app/poker-tournaments/statistics-view';
import {PokerWorkspace} from '@/app/poker-ui/workspace';
import {loadHandHistories,loadHandStats} from '@/lib/poker/hand-histories';
import {GtoDeviationView} from '@/app/poker-ui/gto-deviation-view';
import {HandStatsView} from '@/app/poker-ui/hand-stats-view';
import {PushFoldChart} from '@/app/poker-ui/gto-pushfold-chart';
import {RiverSolverPanel} from '@/app/poker-ui/river-solver-panel';
import {IcmPanel} from '@/app/poker-ui/icm-panel';
import {FlopStrategyPanel} from '@/app/poker-ui/flop-strategy-panel';
import {GtoQuiz} from '@/app/poker-ui/gto-quiz';
import {PreflopChartPanel} from '@/app/poker-ui/preflop-chart-panel';
import {HandHistoryList} from '@/app/poker-ui/hand-history-list';
export const dynamic='force-dynamic';
export default async function Page(){const [data,hands,tendencies]=await Promise.all([loadPokerStatistics(),loadHandHistories(),loadHandStats()]);
 const unavailable=<p>成績を取得できません。<a href="/login">ログイン状態</a>をご確認ください。</p>;
 const panes=[
 {id:'ring',label:'チップ残高・順位',eyebrow:'RING CHIP BALANCE',description:'リング用チップの残高と自分のランキング。',content:data?<StatisticsView data={data} section="ring"/>:unavailable},
 {id:'summary',label:'通算成績',eyebrow:'PLAYER RECORD',description:'終了・確定した大会の成績を振り返る。',content:data?<StatisticsView data={data} section="summary"/>:unavailable},
 {id:'upcoming',label:'参加予定の大会',eyebrow:'YOUR NEXT TOURNAMENT',description:'登録済み・進行中の大会と参加卓を確認。',content:data?<StatisticsView data={data} section="upcoming"/>:unavailable},
 {id:'history',label:'参加大会の履歴',eyebrow:'TOURNAMENT HISTORY',description:'これまでの大会と最終順位。',content:data?<StatisticsView data={data} section="history"/>:unavailable},
 {id:'tendencies',label:'成績・癖の分析',eyebrow:'PLAY TENDENCIES',description:'リングゲームのハンドから、参加率やベットの傾向を集計。',content:tendencies?<><HandStatsView stats={tendencies.ring}/><GtoDeviationView/></>:unavailable},
 {id:'gto',label:'GTO表',eyebrow:'GTO CHARTS',description:'計算で求めた正解の表。チップの量ごとに、参加する手・降りる手を確認できます。（改良中：SBのリンプ・スクイーズ・3人以上のポットは今後対応します）',content:<PushFoldChart/>},
 {id:'preflop',label:'プリフロップ表',eyebrow:'PREFLOP CHARTS',description:'6人卓・100BBで、立場ごとのオープン・コール・3ベットなどの正解の割合。（改良中：SBのリンプ・スクイーズ・3人以上のポットは今後対応します）',content:<PreflopChartPanel/>},
 {id:'flop',label:'フロップ戦略',eyebrow:'FLOP STRATEGY',description:'6人卓・2人・リンプ・3人のポットの場面×代表的なフロップ（200枚まで順次計算中）を前もって計算した、手札ごとの正解の打ち方と、ボードの形ごとの全体まとめ。好きなフロップは近いものを表示。（改良中：SBのリンプ・スクイーズ・3人以上のポットは今後対応します）',content:<FlopStrategyPanel/>},
 {id:'quiz',label:'GTO練習クイズ',eyebrow:'GTO QUIZ',description:'計算済みの場面から出題。自分の打ち方がGTOとどれだけ合っているか採点します。（改良中：SBのリンプ・スクイーズ・3人以上のポットは今後対応します）',content:<GtoQuiz/>},
 {id:'river',label:'リバー計算機',eyebrow:'RIVER SOLVER',description:'リバーの2人勝負を計算して、手札ごとの正解の打ち方を確認できます。（改良中：SBのリンプ・スクイーズ・3人以上のポットは今後対応します）',content:<RiverSolverPanel/>},
 {id:'icm',label:'ICM計算機',eyebrow:'ICM PUSH / FOLD',description:'大会の終盤に、賞金の取り分（ICM）を考えたオールイン・コールの範囲を計算します。',content:<IcmPanel/>},
 {id:'hands',label:'ハンド履歴',eyebrow:'HAND HISTORY',description:'プレイしたハンドを1つずつ再生して振り返る。',content:hands?<HandHistoryList hands={hands} base="/mypage/poker/hands" moreHref={hands.length===20?`/mypage/poker/hands?before=${encodeURIComponent(hands[hands.length-1].playedAt)}`:null}/>:unavailable},
 ];
 // Ring-first release: tournament panes stay hidden until tournaments open.
 return <PokerWorkspace kind="account" panes={POKER_TOURNAMENTS_ENABLED?panes:panes.filter(p=>!['summary','upcoming','history'].includes(p.id))}/>;
}
