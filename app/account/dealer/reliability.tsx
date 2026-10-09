import {Stars} from "@/app/matching/work/stars";
import type { DealerReliability } from "@/lib/dealer-reliability";
import styles from "./reliability.module.css";

export function DealerReliabilityView({ stats, compact=false }: { stats?: DealerReliability; compact?: boolean }) {
 if (!stats) return <p className={styles.note}>勤務実績を確認できません。</p>;
 const rate=(value:number)=>stats.total ? (value/stats.total*100).toFixed(1)+"%" : "未集計";
 return <section className={compact ? styles.compact : styles.panel} aria-label="勤務実績">
  {!compact && <h2>勤務実績</h2>}
  <p className={styles.rating}><Stars rating={stats.average}/> <span>（{stats.rating_count}件の評価・{stats.review_count}件のレビュー）</span></p>
  <dl className={styles.metrics}>
   <div><dt>総勤務回数</dt><dd>{stats.completed}回</dd></div>
   <div><dt>勤務率</dt><dd>{rate(stats.completed)}</dd></div>
   <div><dt>キャンセル率</dt><dd>{rate(stats.cancellations)}</dd></div>
  </dl>
  {compact&&stats.latest_review&&<blockquote className={styles.excerpt}><strong>{stats.latest_review.store_name}</strong><p>{stats.latest_review.review.slice(0,100)}{stats.latest_review.review.length>100?"…":""}</p></blockquote>}
  <p className={styles.note}>集計対象：{stats.total}件{!compact && <> ／ キャンセル {stats.cancellations}件</>}</p>
  {!compact && <p className={styles.note}>勤務率は勤務完了件数を集計対象件数で割った割合です。本サイトで双方が確定した勤務のうち、勤務完了やディーラー都合のキャンセルの確定済み記録を集計します。店舗都合・確認中・未確定の勤務は対象外です。星評価・レビューは双方の勤務完了後に反映します。過去の星評価なしのレビューは平均に含めません。</p>}
 </section>;
}
