"use client";
import { useId } from "react";
import styles from "./number-stepper.module.css";
export default function NumberStepper({label,value,onChange,min=0,max=1000000000,increment=10,disabled=false}:{label:string;value:number;onChange:(value:number)=>void;min?:number;max?:number;increment?:number;disabled?:boolean}) {
 const id=useId();
 const change=(direction:number)=>onChange(Math.max(min,Math.min(max,value+direction*increment)));
 return <span className={styles.control}>
  <button type="button" aria-label={`${label}を${increment}減らす`} aria-controls={id} disabled={disabled||value<=min} onClick={()=>change(-1)}>−</button>
  <input id={id} aria-label={label} type="number" inputMode="numeric" min={min} max={max} step={1} required disabled={disabled} value={value} onChange={e=>onChange(Number(e.target.value))} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();change(e.key==='ArrowUp'?1:-1);}}}/>
  <button type="button" aria-label={`${label}を${increment}増やす`} aria-controls={id} disabled={disabled||value>=max} onClick={()=>change(1)}>＋</button>
 </span>;
}
