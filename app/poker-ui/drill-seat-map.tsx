import {HERO,TRAINER_SEATS,type TrainerHand} from '@/lib/poker/gto-trainer';
import {actText} from './gto-trainer';
import styles from './gto-trainer.module.css';
const PLACES=[[50,87],[14,67],[14,28],[50,11],[86,28],[86,67]];
/** The actual dealt hand and preflop log, never an illustrative replacement. */
export function DrillSeatMap({hand}:{hand:TrainerHand}){
 return <div className={styles.miniTable} role="img" aria-label={`6人卓・あなたは${hand.heroPos}。先のアクションと席`}>
  <div className={styles.miniFelt}><span>あなたの番<small>6人卓・100BB</small></span></div>
  {TRAINER_SEATS.map((id,i)=>{const action=hand.log.filter(a=>a.street==='preflop'&&a.id===id).at(-1);return <span key={id} className={styles.miniSeat} style={{left:`${PLACES[i][0]}%`,top:`${PLACES[i][1]}%`}} data-hero={id===HERO||undefined} data-folded={action?.type==='fold'||undefined}><b>{id===HERO?'自分・':''}{hand.positions[id]}</b><small>{action?(action.allIn?'オールイン':actText(action.type,action.to,false)):id===HERO?'あなたの番':'待ち'}</small></span>;})}
 </div>;
}
export function drillWhy(options:readonly {text:string;freq:number}[],choice:number){
 const best=options.reduce((a,b)=>b.freq>a.freq?b:a,options[0]),picked=options[choice];
 if(!best||!picked)return '';
 return `なぜ：この手は${best.text}（${Math.round(best.freq*100)}%）が中心で、${picked.text}は${Math.round(picked.freq*100)}%と少ないためです。`;
}
