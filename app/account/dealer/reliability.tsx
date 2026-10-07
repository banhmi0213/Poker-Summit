import type { DealerReliability } from "@/lib/dealer-reliability";
import styles from "./reliability.module.css";

export function DealerReliabilityView({ stats, compact=false }: { stats?: DealerReliability; compact?: boolean }) {
 if (!stats) return <p className={styles.note}>勤務実績を確認できません。</p>;
 const rate=(value:number)=>stats.total ? (value/stats.total*100).toFixed(1)+"%" : "未集計";
 return <section className={compact ? styles.compact : styles.panel} aria-label="勤務実績">
  {!compact && <h2>勤務実績</h2>}
  <dl className={styles.metrics}>
   <div><dt>総勤務回数</dt><dd>{stats.completed}回</dd></div>
   <div><dt>キャンセル率</dt><dd>{rate(stats.cancellations)}</dd></div>
   <div><dt>無言キャンセル率</dt><dd>{rate(stats.no_shows)}</dd></div>
  </dl>
  <p className={styles.note}>集計対象：{stats.total}件{!compact && <> ／ キャンセル {stats.cancellations}件（うち無言 {stats.no_shows}件）</>}</p>
  {!compact && <p className={styles.note}>本サイトで双方が確定した勤務のうち、勤務完了・本人都合のキャンセル・確認済みの無言キャンセルを集計します。無言キャンセルはキャンセル率にも含みます。店舗都合・確認中・未確定の勤務は対象外です。</p>}
 </section>;
}
