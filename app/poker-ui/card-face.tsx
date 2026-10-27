'use client';
import type {Card} from '@/lib/poker/engine';
import shared from '@/app/poker-demo/poker-table.module.css';
import {useTablePreferences} from './table-preferences';
import {cardArt,cardSkin} from '@/lib/poker/skins';
export function CardFace({card}:{card:Card}){
 const {settings}=useTablePreferences(),rank=({11:'J',12:'Q',13:'K',14:'A'} as Record<number,string>)[card.rank]??card.rank,suit={s:'♠',h:'♥',d:'♦',c:'♣'}[card.suit];
 // A face skin with a finished image (ロイヤル絵札) draws only the image; the card value stays readable for screen readers.
 const art=cardArt(cardSkin(settings.cardSkin),card);
 if(art)return <><img className={shared.cardArt} src={art} alt="" draggable={false}/><span className={shared.srOnly}>{rank}{suit}</span></>;
 return <><i className={shared.cardCorner} data-card-rank={rank} data-suit={card.suit}>{rank}<em>{suit}</em></i><b className={shared.cardSuit} data-suit={card.suit}>{suit}</b><i className={`${shared.cardCorner} ${shared.cardCornerBottom}`} data-card-rank={rank} data-suit={card.suit} aria-hidden="true">{rank}<em>{suit}</em></i></>;
}
