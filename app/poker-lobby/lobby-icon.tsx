import type {CSSProperties} from 'react';

export type LobbyIconName='home'|'people'|'trophy'|'chart'|'cards'|'bell'|'settings'|'spade';
const paths:Record<LobbyIconName,string>={
 home:'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',
 people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8m6 10v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 trophy:'M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-5 2h10m-8-2h6',
 chart:'M4 21V12h4v9M10 21V7h4v14m2 0V3h4v18',
 cards:'m4 6 9-3 5 15-9 3L4 6Zm12-2 6 2-4 15-5-1',
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
 settings:'m9 3 1-1h4l1 1 .5 2 2 1 2-.5 2 3-.5 2-1.5 1v2l1.5 1 .5 2-2 3-2-.5-2 1L15 21l-1 1h-4l-1-1-.5-2-2-1-2 .5-2-3 .5-2 1.5-1v-2L3.5 9 3 7l2-3 2 .5 2-1ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
 spade:'M12 2C9 6 3 9 3 14c0 5 6 6 9 2 3 4 9 3 9-2 0-5-6-8-9-12ZM12 16l-3 6h6l-3-6Z',
};
export function LobbyIcon({name,className,style}:{name:LobbyIconName;className?:string;style?:CSSProperties}){
 return <svg className={className} style={style} width="24" height="24" viewBox="0 0 24 24" fill={name==='spade'?'currentColor':'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
