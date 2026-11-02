/** 「見せる」 after a hand (owner 2026/10/28: １枚見せる２枚見せる): a seated player who was dealt into the last hand shows
 * one or both of their own cards to the whole table until the next hand starts. In memory only (like stamps). */
import type {Card} from './engine';
export type TableShow={seat:number;handId:string;cards:Card[]};
export const SHOW_KEEP_MS=60000;
export class ShowBoard{
 #tables=new Map<string,(TableShow&{at:number})[]>();
 constructor(private now:()=>number=Date.now){}
 /** Showing again (e.g. first one card, then both) replaces that seat's earlier show for the hand. */
 post(table:string,handId:string,seat:number,cards:Card[]){const t=this.now(),list=(this.#tables.get(table)??[]).filter(s=>t-s.at<SHOW_KEEP_MS&&s.handId===handId&&s.seat!==seat);
  list.push({seat,handId,cards:cards.map(c=>({rank:c.rank,suit:c.suit})),at:t});this.#tables.set(table,list);}
 recent(table:string):TableShow[]{const t=this.now(),list=(this.#tables.get(table)??[]).filter(s=>t-s.at<SHOW_KEEP_MS);if(list.length)this.#tables.set(table,list);else this.#tables.delete(table);return list.map(({seat,handId,cards})=>({seat,handId,cards}));}
}
