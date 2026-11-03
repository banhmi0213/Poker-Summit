'use client';
import styles from './card-picker.module.css';

/** Card codes: (rank-2)*4 + suit (c,d,h,s), as lib/poker/fast-eval. */
const RANKS='23456789TJQKA',SUITS='cdhs',SUIT_MARK:Record<string,string>={c:'♣',d:'♦',h:'♥',s:'♠'};
export const rankText=(code:number)=>{const r=RANKS[code>>2];return r==='T'?'10':r;};
export const suitMark=(code:number)=>SUIT_MARK[SUITS[code&3]];
export const isRed=(code:number)=>(code&3)===1||(code&3)===2;
/** "Ah Td 7c" → codes, or null when a card is unreadable or repeated. */
export function parseCards(text:string):number[]|null{
 const t=text.replace(/10/g,'T').replace(/[♣]/g,'c').replace(/[♦]/g,'d').replace(/[♥]/g,'h').replace(/[♠]/g,'s').replace(/[\s,、]+/g,'');
 if(t.length%2)return null;const out:number[]=[];
 for(let i=0;i<t.length;i+=2){const r=RANKS.indexOf(t[i].toUpperCase()),s=SUITS.indexOf(t[i+1].toLowerCase());if(r<0||s<0)return null;out.push(r*4+s);}
 return new Set(out).size===out.length?out:null;
}
export const cardsText=(cs:readonly (number|null)[])=>cs.filter((c):c is number=>c!==null).map(c=>RANKS[c>>2]+SUITS[c&3]).join(' ');

/** One card place: the card, or a + to choose one. */
export function CardSlot({card,active,label,onClick,name}:{card:number|null;active?:boolean;label?:string;onClick:()=>void;name:string}){
 return <span className={styles.slotWrap}>
  <button type="button" className={styles.slot} onClick={onClick} data-card={card!==null||undefined} data-red={card!==null&&isRed(card)||undefined} data-active={active||undefined} aria-label={card===null?`${name}を選ぶ`:`${name}：${rankText(card)}${suitMark(card)}（押して変える）`} aria-pressed={active}>
   {card===null?'+':<>{rankText(card)}<span>{suitMark(card)}</span></>}
  </button>
  {label!==undefined&&<small>{label}</small>}
 </span>;
}

/** The 52 cards to tap, with cards already used greyed out, and a box to type them instead. */
export function CardGrid({title,blocked,onPick,onDone,onClear,typedPlaceholder,onTyped}:{title:string;blocked:ReadonlySet<number>;onPick:(code:number)=>void;onDone:()=>void;onClear?:()=>void;typedPlaceholder?:string;onTyped?:(codes:number[])=>void}){
 return <div className={styles.panel} role="group" aria-label="カードを選ぶ">
  <div className={styles.panelHead}><span><b>{title}</b>カードを押して選びます</span><span>{onClear&&<button type="button" onClick={onClear}>消す</button>} <button type="button" onClick={onDone}>完了</button></span></div>
  <div className={styles.grid}>{[3,2,1,0].map(s=>[...RANKS].reverse().map((_,k)=>{const code=(12-k)*4+s;return <button key={code} type="button" className={styles.card} data-red={isRed(code)||undefined} disabled={blocked.has(code)} onClick={()=>onPick(code)} aria-label={`${rankText(code)}${suitMark(code)}`}>{rankText(code)}<span>{suitMark(code)}</span></button>;}))}</div>
  {onTyped&&<label className={styles.typed}>または入力（T=10、c♣ d♦ h♥ s♠）<input placeholder={typedPlaceholder} onChange={e=>{const cs=parseCards(e.target.value);if(cs&&cs.length)onTyped(cs);}}/></label>}
 </div>;
}
