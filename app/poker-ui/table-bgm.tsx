'use client';
import {useEffect,useRef} from 'react';
import {TableBgm} from '@/lib/poker/table-bgm';
import {useSoundSettings} from '@/lib/poker/sound-settings';

/** Plays the table BGM while the setting is on. Starts on the first tap/key (autoplay rules), pauses in background tabs. */
export function TableBgmPlayer(){
 const [settings]=useSoundSettings(),player=useRef<TableBgm|null>(null),wanted=useRef(settings.bgm);
 wanted.current=settings.bgm;
 useEffect(()=>{
  const bgm=new TableBgm();player.current=bgm;
  const visible=()=>typeof document!=='undefined'&&document.visibilityState==='visible';
  const tryStart=()=>{if(wanted.current&&visible())void bgm.start();};
  const visibility=()=>{if(visible())tryStart();else bgm.stop();};
  // Listen on window (capture) so table code keeps its own document listeners untouched.
  const target=typeof window!=='undefined'&&typeof window.addEventListener==='function'?window:null;
  target?.addEventListener('pointerdown',tryStart,true);target?.addEventListener('keydown',tryStart,true);if(typeof document!=='undefined'&&typeof document.addEventListener==='function')document.addEventListener('visibilitychange',visibility);
  tryStart();
  return()=>{target?.removeEventListener('pointerdown',tryStart,true);target?.removeEventListener('keydown',tryStart,true);if(typeof document!=='undefined'&&typeof document.removeEventListener==='function')document.removeEventListener('visibilitychange',visibility);bgm.close();player.current=null;};
 },[]);
 useEffect(()=>{const bgm=player.current;if(!bgm)return;if(settings.bgm)void bgm.start();else bgm.stop();},[settings.bgm]);
 return null;
}
