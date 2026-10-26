import {loadHandHistories} from '@/lib/poker/hand-histories';
import {HandHistoryList} from '@/app/poker-ui/hand-history-list';
import styles from '@/app/poker-ui/hand-history.module.css';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:{before?:string}}){
 const hands=await loadHandHistories(true,searchParams.before);
 const more=hands&&hands.length===20?`/admin/poker-hands?before=${encodeURIComponent(hands[hands.length-1].playedAt)}`:null;
 return <main className="container"><h1>ポーカー ハンド履歴</h1><p>運営専用です。フォールドした手札を含め、全員の手札を表示します。チップの受け渡しなど不正の確認に使い、外部に公開しないでください。</p>
  {hands?<div className={styles.surface}><HandHistoryList hands={hands} base="/admin/poker-hands" admin moreHref={more}/></div>:<p>運営権限またはハンド履歴の設定をご確認ください。データを取得できませんでした。</p>}</main>;
}
