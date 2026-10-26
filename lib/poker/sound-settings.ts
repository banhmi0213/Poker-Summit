'use client';
/** Per-browser sound settings shared by every table: effects and BGM, both on by default, remembered across visits. */
import {useSyncExternalStore} from 'react';
export type SoundSettings={se:boolean;bgm:boolean};
const KEY='poker-sound-v1',DEFAULTS:SoundSettings={se:true,bgm:true};
let current:SoundSettings|null=null;const listeners=new Set<()=>void>();
function read():SoundSettings{
 if(current)return current;current=DEFAULTS;
 try{const raw=typeof window==='undefined'?null:window.localStorage.getItem(KEY);if(raw){const v=JSON.parse(raw);current={se:typeof v?.se==='boolean'?v.se:true,bgm:typeof v?.bgm==='boolean'?v.bgm:true};}}catch{/* Storage may be blocked; defaults still work. */}
 return current;
}
export function getSoundSettings(){return read();}
export function setSoundSettings(change:Partial<SoundSettings>){
 current={...read(),...change};try{window.localStorage.setItem(KEY,JSON.stringify(current));}catch{/* Not remembered, but applied now. */}
 listeners.forEach(fn=>fn());
}
function subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
export function useSoundSettings():[SoundSettings,(change:Partial<SoundSettings>)=>void]{
 const value=useSyncExternalStore(subscribe,read,()=>DEFAULTS);
 return [value,setSoundSettings];
}
