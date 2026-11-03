import {strategyColor,type StrategyAction} from './strategy-colors';
import styles from './gto-chart.module.css';
export function StrategyLegend({actions}:{actions:readonly StrategyAction[]}){
 return <div className={styles.strategyLegend} aria-label="表の色の見方"><div className={styles.legendItems}>{actions.map((a,i)=><span key={i} className={styles.actionKey}><i style={{background:strategyColor(a,actions)}} aria-hidden="true"/>{a.label}</span>)}<span className={styles.actionKey}><i className={styles.unavailableKey} aria-hidden="true"/>対象外</span></div><p>マスの色の割合が、その手で各アクションを選ぶ割合です。斜線のマスは、この場面に来ない手です。</p></div>;
}
