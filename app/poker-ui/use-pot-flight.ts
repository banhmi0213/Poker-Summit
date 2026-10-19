'use client';
import {useEffect,useRef} from 'react';

/** Keep the visual payout aligned with actual avatars at every table size. */
export function usePotFlight(active:boolean){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const table=ref.current;if(!active||!table)return;
  let animations:Animation[]=[];
  const measure=()=>{
   for(const animation of animations)animation.cancel();animations=[];
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
    // Start every coin only after its source and destination have been measured.
    // Concrete per-coin coordinates avoid early CSS keyframes using fallback distances.
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    flight.querySelectorAll?.<HTMLElement>('[data-pot-coin]').forEach((coin,index)=>{
     if(typeof coin.animate!=='function')return;
     const rect=coin.getBoundingClientRect(),dx=(endX-rect.left-rect.width/2)/scaleX,dy=(endY-rect.top-rect.height/2)/scaleY;
     const base=getComputedStyle(coin).transform,origin=base==='none'?'':base;
     const start=`translate(0px,0px) ${origin}`,end=`translate(${dx}px,${dy}px) ${origin}`;
     const duration=Number(flight.dataset.potDuration)||1300;
     animations.push(coin.animate([{offset:0,transform:start,opacity:0},{offset:.08,transform:start,opacity:1,easing:'cubic-bezier(.2,.6,.22,1)'},{offset:.7,transform:end,opacity:1},{offset:.9,transform:end,opacity:1},{offset:1,transform:end,opacity:0}],{duration,delay:index*(duration===800?70:130),easing:'linear',fill:'both'}));
    });
   });
  };
  measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(table);
  window.addEventListener('resize',measure);return()=>{for(const animation of animations)animation.cancel();observer?.disconnect();window.removeEventListener('resize',measure);};
 },[active]);
 return ref;
}
