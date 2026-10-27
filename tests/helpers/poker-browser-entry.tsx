/** Actual production components, mounted only by the isolated E2E test gateway. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import Table from '../../app/poker-online/[roomId]/table';
import AssignedRooms from '../../app/poker-lobby/assigned-rooms';
import TournamentRegistration from '../../app/poker-lobby/tournament-registration';
import Navigation from '../../app/poker-demo/game-navigation';
import shared from '../../app/poker-demo/poker-table.module.css';
declare global{interface Window{POKER_E2E_EVENTS:string}}
const room=/^\/poker-online\/([a-f0-9-]{36})$/i.exec(location.pathname);
createRoot(document.getElementById('root')!).render(room?<div className={shared.gamePage}><Navigation header={<a href="/poker-lobby">サイトメニュー</a>} footer={<a href="/">トップページ</a>}/><main className={shared.gameMain}><Table roomId={room[1]} enabled eventsOrigin={window.POKER_E2E_EVENTS}/></main></div>:<main><AssignedRooms enabled/><TournamentRegistration enabled/></main>);
