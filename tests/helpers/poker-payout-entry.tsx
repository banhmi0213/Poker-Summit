/** Production payout CSS/hook rendered with all six winner destinations. */
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {usePotFlight} from '../../app/poker-ui/use-pot-flight';
import styles from '../../app/poker-demo/poker-table.module.css';
declare global{interface Window{payout:(active:boolean)=>void}}
const seats=['p2','p3','p4','p5','p6','you'];
function Fixture(){const [active,setActive]=useState(false);window.payout=setActive;const ref=usePotFlight(active);return <div className={styles.table} ref={ref} style={{margin:'80px auto',width:'min(520px,90vw)',height:600,transform:'scale(.85)',transformOrigin:'top center'}}><div className={styles.felt}><div className={styles.pot} data-pot-source>POT 6,000</div></div>{seats.map((id,i)=><div key={id} className={i===0?styles.topSeats:i===1?styles.edgeSeatThree:i===2?styles.edgeSeatFour:i===3?styles.edgeSeatFive:i===4?styles.edgeSeatSix:styles.self}><div className={styles.avatar} data-pot-target={id}>{id}</div></div>)}{active&&<div className={styles.awardAnimationLayer}>{seats.map(id=><div key={id} className={styles.awardFlight} data-pot-winner={id}>{[0,1,2].map(i=><span key={i} data-pot-coin className={styles.awardCoin}>♠</span>)}</div>)}</div>}</div>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
