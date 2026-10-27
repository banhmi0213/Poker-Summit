'use client';
import {useCallback,useEffect,useState} from 'react';
import {isHudColor,type HudColor} from '@/lib/poker/player-hud';
export type TableMember={seat:number;displayName:string;avatarUrl:string|null;you:boolean;color:HudColor|null};
export function ringTableIdFromPath(){if(typeof window==='undefined')return null;return /^\/poker-ring\/([a-f0-9-]{36})/i.exec(window.location.pathname)?.[1]??null;}
export function useTableMembers(){const [members,setMembers]=useState<Record<number,TableMember>>({});useEffect(()=>{const id=ringTableIdFromPath();if(!id)return;let active=true;const update=async()=>{try{const r=await fetch('/api/poker/table-members?table='+encodeURIComponent(id),{cache:'no-store'});if(!r.ok)return;const data=await r.json(),next:Record<number,TableMember>={};for(const v of data.members??[])if(Number.isInteger(v.seat)&&v.seat>=1&&v.seat<=6&&typeof v.displayName==='string'&&(v.avatarUrl===null||typeof v.avatarUrl==='string'))next[v.seat]={seat:v.seat,displayName:v.displayName,avatarUrl:v.avatarUrl,you:v.you===true,color:isHudColor(v.color)?v.color:null};if(active)setMembers(next);}catch{}};void update();const timer=setInterval(update,5000);return()=>{active=false;clearInterval(timer);};},[]);
 const setColor=useCallback((seat:number,color:HudColor|null)=>setMembers(m=>m[seat]?{...m,[seat]:{...m[seat],color}}:m),[]);
 return {members,setColor};}
