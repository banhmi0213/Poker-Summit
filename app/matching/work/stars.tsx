import styles from "./stars.module.css";
export function Stars({rating}:{rating:number|null|undefined}) {
 if(rating==null)return <span className={styles.unrated}>星評価なし</span>;
 return <span className={styles.display} aria-label={`5つ星中${rating.toFixed(1)}`}><span className={styles.stars} aria-hidden="true"><span>★★★★★</span><span className={styles.fill} style={{width:`${rating/5*100}%`}}>★★★★★</span></span> <strong>{rating.toFixed(1)}</strong></span>;
}
