'use client';
import {useEffect,useRef} from 'react';

/** Keep the visual payout aligned with actual avatars at every table size. */
export function usePotFlight(active:boolean){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const table=ref.current;if(!active||!table)return;
  const measure=()=>{
   const bounds=table.getBoundingClientRect(),pot=table.querySelector<HTMLElement>('[data-pot-source]')?.getBoundingClientRect();
   if(!pot||!bounds.width||!bounds.height)return;
   const x=pot.left+pot.width/2,y=pot.top+pot.height/2;
   table.querySelectorAll<HTMLElement>('[data-pot-winner]').forEach(flight=>{
    const target=Array.from(table.querySelectorAll<HTMLElement>('[data-pot-target]')).find(node=>node.dataset.potTarget===flight.dataset.potWinner)?.getBoundingClientRect();
    if(!target)return;
    const endX=target.left+target.width/2,endY=target.top+target.height/2;
    const values={'--pot-start-x':`${(x-bounds.left)/bounds.width*100}%`,'--pot-start-y':`${(y-bounds.top)/bounds.height*100}%`,'--pot-end-x':`${(endX-bounds.left)/bounds.width*100}%`,'--pot-end-y':`${(endY-bounds.top)/bounds.height*100}%`,'--award-x':`${endX-x}px`,'--award-y':`${endY-y}px`};
    for(const [key,value] of Object.entries(values))flight.style.setProperty(key,value);
   });
  };
  measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(table);
  window.addEventListener('resize',measure);return()=>{observer?.disconnect();window.removeEventListener('resize',measure);};
 },[active]);
 return ref;
}
