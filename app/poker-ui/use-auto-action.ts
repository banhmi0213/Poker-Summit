'use client';
import {useEffect,useRef,useState} from 'react';
import type {BettingAction} from '@/lib/poker/betting';
type Mode='check'|'fold';
/** Per-hand preferences only. Every action still uses the normal confirmed transport. */
export function useAutoAction(handId:string|null,revision:number,legal:{check:boolean;fold:boolean}|null,blocked:boolean,onAction:(action:BettingAction)=>void){
 const [choice,setChoice]=useState<{hand:string|null;mode:Mode|null}>({hand:null,mode:null}),sent=useRef<string|null>(null),action=useRef(onAction);action.current=onAction;
 const mode=choice.hand===handId?choice.mode:null;
 useEffect(()=>{if(!handId||!mode||!legal||blocked)return;const key=handId+':'+revision;if(sent.current===key)return;if(mode==='check'&&!legal.check){setChoice({hand:handId,mode:null});return;}if(mode==='fold'&&!legal.fold)return;sent.current=key;action.current({type:mode});},[handId,revision,legal?.check,legal?.fold,Boolean(legal),blocked,mode]);
 return {mode,toggle:(value:Mode)=>setChoice({hand:handId,mode:mode===value?null:value}),cancel:()=>setChoice({hand:handId,mode:null})};
}
