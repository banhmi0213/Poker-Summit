import type {Card} from '@/lib/poker/engine';
import shared from '@/app/poker-demo/poker-table.module.css';
export function CardFace({card}:{card:Card}){const rank=({11:'J',12:'Q',13:'K',14:'A'} as Record<number,string>)[card.rank]??card.rank,suit={s:'♠',h:'♥',d:'♦',c:'♣'}[card.suit];return <><i className={shared.cardCorner}>{rank}<em style={{fontStyle:'normal'}}>{suit}</em></i><b className={shared.cardSuit}>{suit}</b></>;}
