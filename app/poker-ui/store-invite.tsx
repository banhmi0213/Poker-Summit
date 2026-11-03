import Link from 'next/link';
import styles from './gto-chart.module.css';

/** From practice to a real table (owner 2026/10/30: 練習・実戦・振り返りのあと「店舗行きたいな」となったら探せるように).
 * A small note under the GTO trainer and the hand review that leads to the store search. */
export function StoreInvite(){
 return <aside className={styles.storeInvite} aria-label="お店で打つ">
  <b>実際のお店でも打ってみませんか</b>
  <span>練習した打ち方を、お店のテーブルで試せます。全国のポーカー店をPokerSummitで探せます。</span>
  <Link href="/stores">ポーカー店を探す</Link>
 </aside>;
}
