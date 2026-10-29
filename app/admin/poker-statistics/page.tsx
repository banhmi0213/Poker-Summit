import {loadPokerStatistics} from '@/lib/poker/statistics';
import {StatisticsView} from '@/app/poker-tournaments/statistics-view';
export const dynamic='force-dynamic';
export default async function Page(){const data=await loadPokerStatistics(true);return <main className="container"><h1>オンラインポーカー成績・ランキング</h1>{data?<><p><a className="btn" href="/admin/poker-statistics/export?type=players">通算成績CSV</a> <a className="btn" href="/admin/poker-statistics/export?type=history">歴代大会結果CSV</a> <a className="btn" href="/admin/poker-statistics/export?type=ring">リングランキングCSV</a></p><StatisticsView data={data} admin/></>:<p>運営権限または集計機能の設定をご確認ください。データを取得できませんでした。</p>}</main>;}
