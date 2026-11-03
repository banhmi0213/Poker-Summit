import {strategyColor} from './strategy-colors';
import styles from './gto-answer-bars.module.css';
type Option={text:string;freq:number;kind?:string};
const kindOf=(o:Option)=>o.kind??(/^フォールド/.test(o.text)?'fold':/^チェック/.test(o.text)?'check':/^コール|^リンプ/.test(o.text)?'call':/^ベット/.test(o.text)?'bet':'raise');
/** Display only: use the same palette as the chart, and the unmodified answer frequencies. */
export function GtoAnswerBars({options,chosen}:{options:readonly Option[];chosen?:string}){
 const actions=options.map(o=>({kind:kindOf(o),label:o.text}));
 return <div className={styles.bars} data-answer-bars aria-label="GTOが選ぶ割合">{options.map((o,i)=>{const value=Math.max(0,Math.min(100,o.freq*100));return <div key={i} className={styles.row} data-chosen={chosen===o.text||undefined}>
  <span>{o.text}{chosen===o.text&&<small>自分の選択</small>}</span><strong>{Math.round(value)}%</strong>
  <div className={styles.track} role="meter" aria-label={o.text} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><i style={{width:`${value}%`,background:strategyColor(actions[i],actions)}}/></div>
 </div>;})}</div>;
}
