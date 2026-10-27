'use client';
/** Per-browser sound settings shared by every table: effects and BGM, both on by default, remembered across visits. */
import {useSyncExternalStore} from 'react';
/** bgmVolume: 0〜100 (70 = the original level). seVolume: 0〜100 (100 = the original level). */
export type SoundSettings={se:boolean;bgm:boolean;bgmVolume:number;seVolume:number};
const KEY='poker-sound-v1',DEFAULTS:SoundSettings={se:true,bgm:true,bgmVolume:70,seVolume:100};
let current:SoundSettings|null=null;const listeners=new Set<()=>void>();
function read():SoundSettings{
 if(current)return current;current=DEFAULTS;
 try{const raw=typeof window==='undefined'?null:window.localStorage.getItem(KEY);if(raw){const v=JSON.parse(raw);current={se:typeof v?.se==='boolean'?v.se:true,bgm:typeof v?.bgm==='boolean'?v.bgm:true,bgmVolume:Number.isFinite(v?.bgmVolume)?Math.min(100,Math.max(0,Math.round(v.bgmVolume))):70,seVolume:Number.isFinite(v?.seVolume)?Math.min(100,Math.max(0,Math.round(v.seVolume))):100};}}catch{/* Storage may be blocked; defaults still work. */}
 return current;
}
export function getSoundSettings(){return read();}
export function setSoundSettings(change:Partial<SoundSettings>){
 current={...read(),...change};try{window.localStorage.setItem(KEY,JSON.stringify(current));}catch{/* Not remembered, but applied now. */}
 listeners.forEach(fn=>fn());
}
function subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
export const subscribeSoundSettings=subscribe;
export function useSoundSettings():[SoundSettings,(change:Partial<SoundSettings>)=>void]{
 const value=useSyncExternalStore(subscribe,read,()=>DEFAULTS);
 return [value,setSoundSettings];
}
