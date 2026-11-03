'use client';
import {useEffect} from 'react';
let locks=0;
let restore:(()=>void)|undefined;
/** Release on leaving play, changing tabs, unmounting, or resizing to desktop. */
export function MobilePlayGuard({active}:{active:boolean}){
 useEffect(()=>{
  if(!active)return;
  const media=window.matchMedia('(max-width:700px)');let held=false;
  const release=()=>{if(!held)return;held=false;if(--locks===0){restore?.();restore=undefined;}};
  const update=()=>{
   if(!media.matches){release();return;}if(held)return;held=true;
   if(locks++===0){
    const elements=[document.documentElement,document.body];
    const saved=elements.map(el=>({value:el.style.getPropertyValue('overscroll-behavior'),priority:el.style.getPropertyPriority('overscroll-behavior')}));
    elements.forEach(el=>el.style.setProperty('overscroll-behavior','none','important'));
    restore=()=>elements.forEach((el,i)=>{if(saved[i].value)el.style.setProperty('overscroll-behavior',saved[i].value,saved[i].priority);else el.style.removeProperty('overscroll-behavior');});
   }
  };
  update();media.addEventListener('change',update);return()=>{media.removeEventListener('change',update);release();};
 },[active]);
 return active?<span hidden data-gto-playing/>:null;
}
