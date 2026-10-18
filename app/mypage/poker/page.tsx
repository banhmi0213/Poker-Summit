import {loadPokerStatistics} from '@/lib/poker/statistics';
import {StatisticsView} from '@/app/poker-tournaments/statistics-view';
export const dynamic='force-dynamic';
export default async function Page(){const data=await loadPokerStatistics();return <main className="container"><h1>オンラインポーカー</h1><p><a href="/mypage">マイページへ戻る</a> · <a href="/poker-lobby">ロビーへ</a></p>{data?<StatisticsView data={data}/>:<p>成績を取得できません。ログイン状態をご確認ください。集計機能が未設定の場合も表示できません。</p>}</main>;}
