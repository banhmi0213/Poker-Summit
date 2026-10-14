import Link from "next/link";
import { JOB_ENTRANCES, jobEntranceHref } from "@/lib/job-categories";
import styles from "./job-category-entrances.module.css";
export function JobCategoryEntrances({ pref = "" }: { pref?: string }) {
  return <div className={styles.grid}>{JOB_ENTRANCES.map(entry => <Link key={entry.label} className={styles.card} href={jobEntranceHref(entry, pref)} aria-label={`${entry.label}の求人を見る`}>
    <span className={styles.artwork}><img src="/images/job-categories-photo-v1.webp" alt={entry.label} width={1536} height={1024} loading="lazy"
      style={{ left: `${-entry.x / 742 * 100}%`, top: `${-entry.y / 284 * 100}%` }} /></span>
  </Link>)}</div>;
}
