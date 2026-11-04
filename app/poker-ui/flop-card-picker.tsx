'use client';
import {useEffect,useRef,useState} from 'react';
import styles from './flop-card-picker.module.css';
const RANKS='AKQJT98765432';
const SUITS=[['s','♠','スペード'],['h','♥','ハート'],['d','♦','ダイヤ'],['c','♣','クラブ']] as const;
const split=(flop:string)=>[flop.slice(0,2),flop.slice(2,4),flop.slice(4,6)];
const text=(card:string)=>card?`${card[0]}${SUITS.find(s=>s[0]===card[1])?.[1]??''}`:'未選択';
export function FlopCardPicker({initialFlop,onChoose,disabled=false}:{initialFlop:string;onChoose:(flop:string)=>void;disabled?:boolean}){
 const pickerRef=useRef<HTMLFieldSetElement>(null);
 const [cards,setCards]=useState(()=>split(initialFlop)),[active,setActive]=useState(0),[rank,setRank]=useState(initialFlop[0]??'A');
 useEffect(()=>{setCards(split(initialFlop));setActive(0);setRank(initialFlop[0]??'A');},[initialFlop]);
 const duplicate=(card:string)=>cards.some((c,i)=>i!==active&&c===card);
 const ready=cards.every(c=>c.length===2)&&new Set(cards).size===3;
 useEffect(()=>{
  if(!ready||active<0)return;
  const finishEditing=(event:PointerEvent)=>{
   if(event.target instanceof Node && pickerRef.current && !pickerRef.current.contains(event.target))setActive(-1);
  };
  document.addEventListener('pointerdown',finishEditing,true);
  return ()=>document.removeEventListener('pointerdown',finishEditing,true);
 },[ready,active]);
 function chooseSuit(suit:string){if(active<0)return;const card=rank+suit;if(duplicate(card))return;
  const next=cards.map((c,i)=>i===active?card:c);setCards(next);
  const nextSlot=next.findIndex((c,i)=>i>active&&!c);if(nextSlot>=0){setActive(nextSlot);setRank('A');}
  else if(active<2){setActive(active+1);setRank(next[active+1]?.[0]??'A');}
  else {setActive(-1);}
 }
 return <fieldset ref={pickerRef} className={styles.picker} disabled={disabled}>
  <legend>フロップの3枚を選ぶ</legend>
  <div className={styles.slots}>{cards.map((card,i)=><button key={i} type="button" aria-label={`${i+1}枚目のカード：${text(card)}`} aria-pressed={active===i} onClick={()=>{setActive(i);setRank(card[0]??'A');}}><small>{i+1}枚目{active===i?'・選択中':''}</small><strong>{text(card)}</strong></button>)}</div>
  <p className={styles.selectionStatus} role="status"><strong>{active<0?"3枚のカードを選択しました":`${active+1}枚目を編集中`}</strong><span hidden={active<0}>ランク：{rank} ／ スート：{cards[active]?.[0]===rank ? (SUITS.find(s=>s[0]===cards[active]?.[1])?.[2]??"未選択") : "未選択"}</span><span>{active<0?"「このフロップを表示」を押してください。変更する場合はカードを選んでください。":`${active+1}枚目のランクとスートを選んでください`}</span></p>
  <div className={styles.ranks} role="group" aria-label="ランク">{[...RANKS].map(r=><button type="button" key={r} aria-label={`ランク ${r}`} aria-pressed={active>=0&&rank===r} disabled={active<0} onClick={()=>setRank(r)}>{r}</button>)}</div>
  <div className={styles.suits} role="group" aria-label="スート">{SUITS.map(([s,symbol,label])=><button type="button" key={s} aria-label={`スート ${label}`} aria-pressed={cards[active]===rank+s} disabled={active<0||duplicate(rank+s)} onClick={()=>chooseSuit(s)}>{symbol}<small>{label}</small></button>)}</div>
  <div className={styles.actions}><button type="button" onClick={()=>{setCards(['','','']);setActive(0);setRank('A');}}>選び直す</button><button type="button" disabled={!ready} onClick={()=>onChoose(cards.join(''))}>このフロップを表示</button></div>
 </fieldset>;
}
