'use client';
import type {Card} from '@/lib/poker/engine';
import shared from '@/app/poker-demo/poker-table.module.css';
import {useTablePreferences} from './table-preferences';
import {useEffect} from 'react';
import {cardArt,cardSkin,type CardSkin} from '@/lib/poker/skins';

/** Fetch every finished card image of a face skin once, as soon as the skin is in use, so J/Q/K never flash white
 * while their image loads (owner 2026/10/27). */
const preloaded=new Set<string>(),keep:HTMLImageElement[]=[];
function preloadSkin(skin:CardSkin){if(!skin.art||typeof Image==='undefined')return;for(const bySuit of Object.values(skin.art))for(const src of Object.values(bySuit??{})){if(!src||preloaded.has(src))continue;preloaded.add(src);const img=new Image();img.decoding='async';img.src=src;keep.push(img);}}
export function CardFace({card}:{card:Card}){
 const {settings}=useTablePreferences(),rank=({11:'J',12:'Q',13:'K',14:'A'} as Record<number,string>)[card.rank]??card.rank,suit={s:'♠',h:'♥',d:'♦',c:'♣'}[card.suit];
 const skin=cardSkin(settings.cardSkin);
 useEffect(()=>{preloadSkin(skin);},[skin]);
 // A face skin with a finished image (ロイヤル絵札) draws the image over the plain face, so the card is never blank
 // while the image loads; the plain face is hidden from screen readers by the image's own text.
 const art=cardArt(skin,card);
 const face=<><i className={shared.cardCorner} data-card-rank={rank} data-suit={card.suit} aria-hidden={art?true:undefined}>{rank}<em>{suit}</em></i><b className={shared.cardSuit} data-suit={card.suit} aria-hidden={art?true:undefined}>{suit}</b><i className={`${shared.cardCorner} ${shared.cardCornerBottom}`} data-card-rank={rank} data-suit={card.suit} aria-hidden="true">{rank}<em>{suit}</em></i></>;
 if(art)return <>{face}<img className={shared.cardArt} src={art} alt="" draggable={false} decoding="async"/><span className={shared.srOnly}>{rank}{suit}</span></>;
 return <><i className={shared.cardCorner} data-card-rank={rank} data-suit={card.suit}>{rank}<em>{suit}</em></i><b className={shared.cardSuit} data-suit={card.suit}>{suit}</b><i className={`${shared.cardCorner} ${shared.cardCornerBottom}`} data-card-rank={rank} data-suit={card.suit} aria-hidden="true">{rank}<em>{suit}</em></i></>;
}
