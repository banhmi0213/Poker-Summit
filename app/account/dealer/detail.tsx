import type { DealerProfile } from "@/lib/dealers";
import styles from "./dealer.module.css";
export function DealerDetail({ profile, address, photo }: { profile: DealerProfile; address: string; photo: string | null }){
 return <section className={styles.card}><div className={styles.top}>{photo ? <img className={styles.photo} src={photo} alt={profile.full_name+"のプロフィール写真"}/> : <div className={styles.photoEmpty}>写真未登録</div>}<div><h2>{profile.full_name}</h2><span className={styles.tag}>{profile.dealer_type}</span></div></div><dl className={styles.facts}><div><dt>氏名</dt><dd>{profile.full_name}</dd></div><div><dt>年齢</dt><dd>{profile.age}歳</dd></div><div><dt>住所</dt><dd>{profile.pref} {address}</dd></div><div><dt>対応可能なゲーム種目</dt><dd><div className={styles.tags}>{profile.games.map(g=><span className={styles.tag} key={g}>{g}</span>)}</div></dd></div><div><dt>経験年数</dt><dd>{profile.experience_years}年</dd></div><div><dt>アピールポイント</dt><dd>{profile.appeal || "未記載"}</dd></div></dl></section>;
}
