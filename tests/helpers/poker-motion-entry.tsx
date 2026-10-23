/** Browser fixture renders the production ring table; no auth or live data. */
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import RingLiveTable from '../../app/poker-ui/ring-live-table';
import type {RingPlayView} from '../../lib/poker/ring-play-state';
declare global{interface Window{motionSet:(play:RingPlayView|null)=>void}}
function Fixture(){const [play,setPlay]=useState<RingPlayView|null>(null);window.motionSet=setPlay;return play?<RingLiveTable play={play} blocked={false} onAction={()=>{}}/>:null;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
