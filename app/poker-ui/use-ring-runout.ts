'use client';
import {useEffect,useState} from 'react';
import type {RingPlayView} from '@/lib/poker/ring-play-state';
import {RingRunoutSequence} from '@/lib/poker/ring-runout-sequence';
export function useRingRunout(incoming:RingPlayView){
 const [sequence]=useState(()=>new RingRunoutSequence(incoming,performance.now()));
 const [shown,setShown]=useState(()=>sequence.view);
 useEffect(()=>{setShown(sequence.push(incoming,performance.now()));},[incoming,sequence]);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>|undefined;let live=true;
  const schedule=()=>{const delay=sequence.delay(performance.now());if(delay===null)return;timer=setTimeout(()=>{if(!live)return;const next=sequence.tick(performance.now());setShown(next);if(next===shown)schedule();},Math.max(1,Math.ceil(delay)));};
  schedule();return()=>{live=false;clearTimeout(timer);};
 },[shown,sequence]);
 return shown;
}
