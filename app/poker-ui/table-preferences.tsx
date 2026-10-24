'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
type Settings={bb:boolean;multipliers:number[]};
const initial:Settings={bb:false,multipliers:[2,3,4]};
const Context=createContext<{settings:Settings;change:(patch:Partial<Settings>)=>void}>({settings:initial,change:()=>{}});
export function TablePreferences({children}:{children:ReactNode}){const [settings,setSettings]=useState(initial),[loaded,setLoaded]=useState(false);useEffect(()=>{try{const v=JSON.parse(localStorage.getItem('summit-table-settings-v1')??'null');if(v&&typeof v.bb==='boolean'&&Array.isArray(v.multipliers)&&v.multipliers.length===3&&v.multipliers.every((n:unknown)=>typeof n==='number'&&[1.5,2,2.5,3,4,5,6,8,10].includes(n)))setSettings(v);}catch{}setLoaded(true);},[]);useEffect(()=>{if(loaded)try{localStorage.setItem('summit-table-settings-v1',JSON.stringify(settings));}catch{}},[loaded,settings]);return <Context.Provider value={{settings,change:patch=>setSettings(v=>({...v,...patch}))}}>{children}</Context.Provider>;}
export const useTablePreferences=()=>useContext(Context);
export function formatTableChips(value:number|null,bb:number,showBB:boolean){if(value===null)return '—';return showBB&&bb>0?`${(value/bb).toLocaleString('ja-JP',{maximumFractionDigits:2})} BB`:value.toLocaleString();}
