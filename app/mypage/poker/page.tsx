import {OwnHudCard} from '@/app/poker-ui/own-hud-card';
import {loadPokerStatistics} from '@/lib/poker/statistics';
import {loadRingMonthly} from '@/lib/poker/ring-monthly';
import {RingMonthlyView} from '@/app/poker-ui/ring-monthly-view';
import {RingRankView} from '@/app/poker-ui/ring-rank-view';
import {RingBbCurve} from '@/app/poker-ui/ring-bb-curve';
import {POKER_TOURNAMENTS_ENABLED} from '@/lib/poker/features';
import {StatisticsView} from '@/app/poker-tournaments/statistics-view';
import {PokerWorkspace} from '@/app/poker-ui/workspace';
import {loadHandHistories,loadHandStats} from '@/lib/poker/hand-histories';
import {GtoDeviationView} from '@/app/poker-ui/gto-deviation-view';
import {HandStatsByStake} from '@/app/poker-ui/hand-stats-by-stake';
import {PushFoldChart} from '@/app/poker-ui/gto-pushfold-chart';
import {RiverSolverPanel} from '@/app/poker-ui/river-solver-panel';
import {EquityCalculator} from '@/app/poker-ui/equity-calculator';
import {GtoWeakSpots} from '@/app/poker-ui/gto-weak-spots';
import {IcmPanel} from '@/app/poker-ui/icm-panel';
import {FlopStrategyPanel} from '@/app/poker-ui/flop-strategy-panel';
import {RangeTrainer} from '@/app/poker-ui/range-trainer';
import {GtoTrainer} from '@/app/poker-ui/gto-trainer';
import {GtoQuiz} from '@/app/poker-ui/gto-quiz';
import {PreflopChartPanel} from '@/app/poker-ui/preflop-chart-panel';
import {HandHistoryGto} from '@/app/poker-ui/hand-history-gto';
import {CosmeticsSettings} from '@/app/poker-ui/my-cosmetics';
import {GtoPlanPanel} from '@/app/poker-ui/gto-plan-panel';
import {paidFeaturesVisible} from '@/lib/billing/visibility';
import {getGtoPlanStatus} from '@/lib/billing/plan';
import {FREE_WEAK_SPOTS,gtoAccess} from '@/lib/poker/gto-access';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams?:{pane?:string;billing?:string;practice?:string;before?:string}}={}){const [data,hands,tendencies,monthly,plan]=await Promise.all([loadPokerStatistics(),loadHandHistories(false,searchParams?.before),loadHandStats(),loadRingMonthly(),getGtoPlanStatus()]);
 const gto=gtoAccess(plan?.tier);
 const unavailable=<p>成績を取得できません。<a href="/login">ログイン状態</a>をご確認ください。</p>;
 const panes=[
 {id:'ring',label:'チップ残高・順位',eyebrow:'RING CHIP BALANCE',description:'リング用チップの残高と自分のランキング。',content:data?<><OwnHudCard stats={tendencies?.ring??null}/><StatisticsView data={data} section="ring"/><RingMonthlyView rows={monthly}/></>:unavailable},
 {id:'rank',label:'ランク',eyebrow:'RING RANK',description:'リングの通算BBで決まるランクと、全体の中の自分の位置。',content:<RingRankView/>},
 {id:'curve',label:'収支グラフ',eyebrow:'RING RESULTS',description:'リングの通算の勝ち負け（BB）の推移。',content:<RingBbCurve/>},
 {id:'summary',label:'通算成績',eyebrow:'PLAYER RECORD',description:'終了・確定した大会の成績を振り返る。',content:data?<StatisticsView data={data} section="summary"/>:unavailable},
 {id:'upcoming',label:'参加予定の大会',eyebrow:'YOUR NEXT TOURNAMENT',description:'登録済み・進行中の大会と参加テーブルを確認。',content:data?<StatisticsView data={data} section="upcoming"/>:unavailable},
 {id:'history',label:'参加大会の履歴',eyebrow:'TOURNAMENT HISTORY',description:'これまでの大会と最終順位。',content:data?<StatisticsView data={data} section="history"/>:unavailable},
 {id:'tendencies',label:'成績・癖の分析',eyebrow:'PLAY TENDENCIES',description:'リングゲームのハンドから、参加率やベットの傾向を集計。',content:tendencies?<><HandStatsByStake all={tendencies.ring} stakes={tendencies.stakes??[]}/><GtoDeviationView/></>:unavailable},
 {id:'gto',label:'GTO表',eyebrow:'GTO CHARTS',description:'少ないチップのオールイン・フォールド表。',about:'2人テーブルで、お互いのチップが少ないとき（25BB以下）に「オールインかフォールドだけ」で戦う場合の正解（ナッシュ均衡）です。SB（ボタン）はオールインするか降りるか、BBはそのオールインにコールするか降りるかを選びます。アンティなし・SB 0.5BB／BB 1BBで、169種類のスタートハンド同士の勝率から求めています。20BBを超えると、オールイン以外（小さめのレイズ）も混ぜる方が得になる場面が増えます。',content:<PushFoldChart/>},
 {id:'preflop',label:'プリフロップ表',eyebrow:'PREFLOP CHARTS',reviewing:true,description:'立場ごとの正解の割合。',about:'プリフロップの打ち方を、計算で求めた表です（6人テーブルと2人のときを切り替えられます。2人のときはボタンがSBで、リンプもあります）。6人テーブルは100BBのほか、大会向けに60・40・20・10BB（BBアンティあり）の表と、キャッシュゲーム向けにレーキ（5%・10%）ありの表もあります。立場ごとに、手札ごとのオープン・コール・3ベットなどの割合を色で表しています。',content:<PreflopChartPanel standard={gto.standard} pro={gto.pro} upsell={gto.upsell}/>},
 {id:'flop',label:'フロップ戦略',eyebrow:'FLOP STRATEGY',reviewing:true,description:'フロップごとの正解の打ち方。',about:'よくある場面とフロップを前もって計算した、手札ごとの正解の打ち方と、ボードの形ごとの全体まとめです。ターン・リバーのカードまで全部計算しています。まだ計算していないフロップは、近いフロップの答えを出します。ベット額の前提：シングルレイズはフロップ33%・66%・125%と3倍レイズ、3ベットポットは33%・66%・100%と2.5倍レイズ、4ベットポットは25%・50%。ターン66%・リバー75%（オールインはポットの1.5倍以内のときだけ）。お互いのレンジはプリフロップの表から出したレンジです。マスにカーソルを当てると、その手の期待値も出ます。',content:<FlopStrategyPanel/>},
 {id:'trainer',label:'GTOと対戦',eyebrow:'PLAY VS GTO',reviewing:true,description:'GTOのCPUと打って、1手ごとに採点。',about:'GTOで打つCPU5人と6人テーブルで1ハンドずつ打ちます。自分のカードは表向き、座る場所は1ハンドごとに1つずつ動きます（BTN → CO → HJ → UTG → BB → SB）。自分が打つたびに、その手でGTOがその打ち方をどれくらい選ぶかで採点します。スタックは毎ハンド全員100BBです。',content:<GtoTrainer standard={gto.standard} upsell={gto.upsell} practiceSpot={searchParams?.practice}/>},
 {id:'weak',label:'弱点分析',eyebrow:'YOUR LEAKS',reviewing:true,description:'損が大きかった場面から並べます。',about:'リング・大会・練習テーブル・GTOと対戦で打った判断を全部GTOと比べて、損が大きかった場面から並べます。ミスは、GTOがその手で選ぶ割合が8%未満の打ち方です。EV損失は、その場でいちばん得な打ち方と比べたチップの差です（プリフロップと、計算が十分に詰められたターン・リバー）。4人以上のポットや計算していない場面は数えていません。',content:<GtoWeakSpots limit={gto.standard?undefined:FREE_WEAK_SPOTS} upsell={gto.upsell}/>},
 {id:'quiz',label:'GTO練習クイズ',eyebrow:'GTO QUIZ',reviewing:true,description:'計算済みの場面から出題して採点。',about:'GTOの計算結果から1問ずつ出題します。自分ならどう打つかを選ぶと、GTOがその手でそれぞれの打ち方を選ぶ割合と照らして採点し、解説を出します。いちばん多い打ち方を選べば100点、GTOが混ぜて使う打ち方は割合に応じた点数です。',content:<GtoQuiz/>},
 {id:'ranges',label:'レンジ練習',eyebrow:'RANGE TRAINER',reviewing:true,description:'自分でレンジを塗って採点。',about:'場面を選んで、自分ならプレイする手をマスを押して塗ります。「答え合わせ」でGTOの表と比べて採点します（塗らなかった手はフォールド）。答え合わせのあとにマスを押すと、その手のGTOの割合が出ます。',content:<RangeTrainer/>},
 {id:'river',label:'リバー計算機',eyebrow:'RIVER SOLVER',description:'ターン・リバーの正解の打ち方を計算。',about:'ターン（4枚目）かリバー（5枚目）からの2人勝負を、近似なしで解きます。ボード・ポット・残りチップ・お互いのレンジを決めると、手札ごとの正解の打ち方（チェック・ベット・コール・フォールドの割合）が出ます。ターンからの計算はリバーのカードを全部解くので、20〜40秒ほどかかります。',content:<RiverSolverPanel/>},
 {id:'equity',label:'勝率計算機',eyebrow:'EQUITY & POT ODDS',description:'勝率とポットオッズの計算。',about:'ハンド同士の勝率と、リバーまでにできる役の確率を計算します。ポットオッズから、コールが得かどうかも確かめられます。',content:<EquityCalculator/>},
 {id:'icm',label:'ICM計算機',eyebrow:'ICM PUSH / FOLD',description:'大会終盤のオールイン・コールの範囲。',about:'大会の終盤に、順位ごとの配分の取り分（ICM）を考えたオールイン・コールの範囲を計算します。',content:<IcmPanel/>},
 {id:'looks',label:'アイコン枠・プレート',eyebrow:'LOOKS',description:'テーブルで他の会員にも見える、アイコン枠とネームプレートを選びます（2026/11/01）。',content:<CosmeticsSettings kinds={['frame','plate']}/>},
 {id:'hands',label:'ハンド履歴',eyebrow:'HAND HISTORY',description:'プレイしたハンドを1つずつ再生して振り返る。',content:hands?<HandHistoryGto hands={hands} base="/mypage/poker/hands" moreHref={hands.length===20?`/mypage/poker?pane=hands&before=${encodeURIComponent(hands[hands.length-1].playedAt)}`:null}/>:unavailable},
 {id:'plan',label:'GTOプラン',eyebrow:'GTO PLAN',description:'ご利用中のGTOプランと、お支払い・解約。',content:<GtoPlanPanel status={plan} message={searchParams?.billing}/>},
 ];
 // Ring-first release: tournament panes stay hidden until tournaments open.
 const tourneyShown=POKER_TOURNAMENTS_ENABLED?panes:panes.filter(p=>!['summary','upcoming','history'].includes(p.id));
 // Paid features hidden (lib/billing/visibility.ts): no 「GTOプラン」 pane, no 「アイコン枠・プレート」 pane.
 const shown=paidFeaturesVisible()?tourneyShown:tourneyShown.filter(p=>!['plan','looks'].includes(p.id));
 // ?pane=plan (back from KOMOJU or a cancel) opens that pane first.
 const first=shown.findIndex(p=>p.id===searchParams?.pane);
 return <PokerWorkspace key={`${searchParams?.pane??'default'}:${searchParams?.practice??''}:${searchParams?.before??''}`} kind="account" panes={first>0?[shown[first],...shown.filter((_,i)=>i!==first)]:shown}/>;
}
