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
   // Absolute children use the padding box, excluding the table's visible border.
   const scaleX=table.offsetWidth?bounds.width/table.offsetWidth:1,scaleY=table.offsetHeight?bounds.height/table.offsetHeight:1;
   const left=bounds.left+(table.clientLeft||0)*scaleX,top=bounds.top+(table.clientTop||0)*scaleY;
   const width=table.clientWidth?table.clientWidth*scaleX:bounds.width,height=table.clientHeight?table.clientHeight*scaleY:bounds.height;
   const x=pot.left+pot.width/2,y=pot.top+pot.height/2;
   table.querySelectorAll<HTMLElement>('[data-pot-winner]').forEach(flight=>{
    const target=Array.from(table.querySelectorAll<HTMLElement>('[data-pot-target]')).find(node=>node.dataset.potTarget===flight.dataset.potWinner)?.getBoundingClientRect();
    if(!target)return;
    const endX=target.left+target.width/2,endY=target.top+target.height/2;
    const values={'--pot-start-x':`${(x-left)/width*100}%`,'--pot-start-y':`${(y-top)/height*100}%`,'--pot-end-x':`${(endX-left)/width*100}%`,'--pot-end-y':`${(endY-top)/height*100}%`,'--award-x':`${(endX-x)/scaleX}px`,'--award-y':`${(endY-y)/scaleY}px`};
    for(const [key,value] of Object.entries(values))flight.style.setProperty(key,value);
   });
  };
  measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(table);
  window.addEventListener('resize',measure);return()=>{observer?.disconnect();window.removeEventListener('resize',measure);};
 },[active]);
 return ref;
}
