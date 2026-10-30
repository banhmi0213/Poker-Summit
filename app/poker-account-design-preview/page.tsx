import {notFound} from 'next/navigation';
import {PokerWorkspace} from '@/app/poker-ui/workspace';
import {HandStatsView} from '@/app/poker-ui/hand-stats-view';
import {HandHistoryList} from '@/app/poker-ui/hand-history-list';
import {HandReplay} from '@/app/poker-ui/hand-replay';
import {PushFoldChart} from '@/app/poker-ui/gto-pushfold-chart';
import {PreflopChartPanel} from '@/app/poker-ui/preflop-chart-panel';
import {FlopStrategyPanel} from '@/app/poker-ui/flop-strategy-panel';
import {IcmPanel} from '@/app/poker-ui/icm-panel';
import {RiverSolverPanel} from '@/app/poker-ui/river-solver-panel';
import {StatisticsView} from '@/app/poker-tournaments/statistics-view';
import type {HandHistoryView,HandStatsSummary} from '@/lib/poker/hand-histories';
import type {PokerStatistics} from '@/lib/poker/statistics';
import type {PokerPane} from '@/app/poker-ui/workspace';
export const dynamic='force-dynamic';
export const metadata={title:'マイページのデザイン確認 | Poker Summit',robots:{index:false,follow:false}};
const sampleHand:HandHistoryView={handId:'00000000-0000-4000-8000-000000000001',kind:'ring',title:'デザイン確認用サンプル',handNumber:12,playedAt:'2026-10-29T00:00:00Z',terms:{sb:1,bb:2,ante:0,anteType:'none',level:0},buttonSeatId:'seat-1',board:[],actions:[{street:'preflop',seatId:'seat-1',type:'sb',amount:1,to:1,allIn:false,pot:3},{street:'preflop',seatId:'seat-2',type:'bb',amount:2,to:2,allIn:false,pot:3},{street:'preflop',seatId:'seat-1',type:'fold',amount:0,to:1,allIn:false,pot:3}],players:[{seatId:'seat-1',seat:1,position:'BTN',name:'サンプルA',startStack:200,endStack:199,net:-1,folded:true,shown:false,you:true,hole:[{rank:13,suit:'s'},{rank:12,suit:'s'}]},{seatId:'seat-2',seat:2,position:'BB',name:'サンプルB',startStack:200,endStack:201,net:1,folded:false,shown:false,you:false,hole:null}],result:{showdown:false,winners:['seat-2'],payouts:{'seat-2':3}}};
const stats:HandStatsSummary={hands:320,net:84,bb100:4.2,vpip:78,pfr:62,three_bet_opp:150,three_bet:12,fold_to_3bet_opp:25,fold_to_3bet:14,cbet_opp:42,cbet:28,fold_to_cbet_opp:33,fold_to_cbet:18,saw_flop:92,wtsd:27,wsd:15,positions:[{position:'BTN',hands:54,net:42,bb100:7.8,vpip:22,pfr:18},{position:'BB',hands:53,net:-12,bb100:-2.3,vpip:16,pfr:7}]};
const records:PokerStatistics={asOf:'2026-10-29T00:00:00Z',ring:[],players:[{member_id:'sample',name:'サンプル',played:4,firsts:1,seconds:1,thirds:0}],upcoming:[],history:[{tournament_id:'sample',title:'デザイン確認用サンプル大会',finished_at:'2026-10-28T12:00:00Z',row:{memberId:'sample',name:'サンプル',place:1,tiedThrough:1}}]};
/** Preview-only visual fixture. No member data, authentication changes or financial actions. */
export default function Page(){
 if(process.env.VERCEL_ENV!=='preview'&&process.env.NODE_ENV!=='development')notFound();
 const panes:PokerPane[]=[
 {id:'tendencies',label:'成績・癖の分析',eyebrow:'DESIGN PREVIEW · SAMPLE DATA',description:'デザイン確認専用のサンプルです。会員の実データではありません。',content:<HandStatsView stats={stats}/>},
 {id:'ring',label:'チップ残高・順位',eyebrow:'RING CHIP BALANCE',description:'デザイン確認専用。実際の残高はログイン後のマイページで確認できます。',content:<section className="card"><h2>チップ残高・順位</h2><p>この確認画面では会員の残高を取得しません。</p><p><a href="/mypage/poker">自分のマイページを開く</a></p></section>},
 {id:'summary',label:'通算成績',eyebrow:'PLAYER RECORD · SAMPLE',description:'デザイン確認用のサンプル成績です。',content:<StatisticsView data={records} section="summary"/>},
 {id:'history',label:'参加大会の履歴',eyebrow:'TOURNAMENT HISTORY · SAMPLE',description:'デザイン確認用のサンプル履歴です。',content:<StatisticsView data={records} section="history"/>},
 {id:'gto',label:'GTO表',eyebrow:'GTO CHARTS',description:'計算済みの表を使ってデザインを確認できます。',content:<PushFoldChart/>},
 {id:'preflop',label:'プリフロップ表',eyebrow:'PREFLOP CHARTS',description:'状況・立場ごとに手札の割合を確認。',content:<PreflopChartPanel/>},
 {id:'flop',label:'フロップ戦略',eyebrow:'FLOP STRATEGY',description:'場面ごとのフロップ戦略を確認。',content:<FlopStrategyPanel/>},
 {id:'quiz',label:'GTO練習クイズ',eyebrow:'GTO QUIZ',description:'計算済みの場面から出題。',content:<><p>デザイン確認用画面では、会員のクイズ成績を読み書きしません。</p><a href="/mypage/poker">マイページでクイズを開く</a></>},
 {id:'river',label:'リバー計算機',eyebrow:'RIVER SOLVER',description:'ボード・ポット・レンジを指定。',content:<RiverSolverPanel/>},
 {id:'icm',label:'ICM計算機',eyebrow:'ICM PUSH / FOLD',description:'賞金の取り分を考えたオールイン・コール。',content:<IcmPanel/>},
 {id:'hands',label:'ハンド履歴',eyebrow:'HAND HISTORY · SAMPLE',description:'デザイン確認用のサンプルハンドです。',content:<HandHistoryList hands={[sampleHand]} base="/mypage/poker/hands"/>},
 {id:'replay',label:'ハンドを再生',eyebrow:'HAND REPLAY · SAMPLE',description:'デザイン確認用。相手の非公開手札は裏向きです。',content:<HandReplay hand={sampleHand}/>},
 ];
 return <PokerWorkspace kind="account" panes={panes}/>;
}
