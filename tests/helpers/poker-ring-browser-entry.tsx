/** Isolated test bundle only; actual production admission component. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import Panel from '../../app/poker-ui/ring-admission-panel';
import shared from '../../app/poker-demo/poker-table.module.css';
const id=/^\/poker-ring\/([a-f0-9-]{36})$/i.exec(location.pathname)?.[1]??null;
const seatFlow=process.env.POKER_SEAT_FLOW==='1';
const full=process.env.POKER_TABLE_UI==='1';
createRoot(document.getElementById('root')!).render(full?<div className={shared.gamePage}><header style={{height:64,flexShrink:0}}>POKER SUMMIT</header><main className={shared.gameMain}><Panel enabled tableId={id} layout="table" productionFlow={seatFlow} initialBuyIn={new URLSearchParams(location.search).get('buyin')??''}/></main></div>:<main style={{maxWidth:1100,margin:'auto',padding:20}}><Panel enabled tableId={id} productionFlow={seatFlow}/></main>);
