import {hudRows,type HudFreeStats} from '@/lib/poker/player-hud';
import styles from './player-hud.module.css';
export function HudStatsGrid({stats}:{stats:HudFreeStats}){
 return <div className={styles.grid}>{[['ハンド数',stats.hands.toLocaleString()] as [string,string],...hudRows(stats)].map(([label,value])=><div key={label} className={styles.stat}><span>{label}</span><b>{value}</b></div>)}</div>;
}
