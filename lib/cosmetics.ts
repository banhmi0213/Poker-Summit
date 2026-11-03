/** Member cosmetics (owner 2026/11/01): アイコン枠・ネームプレート・サミットのスレッドデザイン.
 * Everything here is looks only — never chips, tickets or anything that changes play.
 * PLACEHOLDERS: the non-standard designs below are CSS stand-ins until Daniel's artwork arrives. Adding a real design is
 * one catalog entry (+ its image under public/images/cosmetics/<kind>/<id>.png) and one shop_items row (kind 'cosmetic').
 * Ownership: a member_tickets row (count 1) for shopCode, like skins. Sales (KOMOJU) are not live: no prices are shown. */
import type {CSSProperties} from 'react';
import {paidFeaturesVisible} from '@/lib/billing/visibility';
export type CosmeticKind='frame'|'plate'|'thread';
type Base={id:string;name:string;free:boolean;shopCode?:string;/** Yen, once sales start. */price?:number};
/** Avatar frame: an outline drawn outside the avatar ring, so the turn-timer ring inside keeps working. */
export type FrameItem=Base&{outline?:string;glow?:string;image?:string};
/** Name plate: the name + chip plate under a seat on the tables. */
export type PlateItem=Base&{border?:string;background?:string;text?:string};
/** Thread design: the thread card in サミット｜情報交換 and the thread page header. */
export type ThreadItem=Base&{border?:string;band?:string;badge?:string;badgeColor?:string};
export const FRAME_ITEMS:readonly FrameItem[]=[
 {id:'standard',name:'なし',free:true},
 // Placeholders (CSS only) until Daniel's frames arrive.
 {id:'gold',name:'ゴールド',free:false,shopCode:'frame_gold',outline:'3px solid #d9b45b',glow:'0 0 10px #d9b45b88'},
 {id:'silver',name:'シルバー',free:false,shopCode:'frame_silver',outline:'3px solid #cfd6de',glow:'0 0 8px #cfd6de77'},
 {id:'sakura',name:'桜',free:false,shopCode:'frame_sakura',outline:'3px dotted #f3a6c3',glow:'0 0 8px #f3a6c366'},
 {id:'navy',name:'ネイビー',free:false,shopCode:'frame_navy',outline:'4px double #6a9bd1'},
];
export const PLATE_ITEMS:readonly PlateItem[]=[
 {id:'standard',name:'標準',free:true},
 // Placeholders (CSS only) until Daniel's plates arrive.
 {id:'gold',name:'ゴールド',free:false,shopCode:'plate_gold',border:'#e2c26a',background:'linear-gradient(#4a3a14,#1c160a)',text:'#ffe9a8'},
 {id:'silver',name:'シルバー',free:false,shopCode:'plate_silver',border:'#cfd6de',background:'linear-gradient(#3b4148,#16191d)',text:'#f2f5f8'},
 {id:'sakura',name:'桜',free:false,shopCode:'plate_sakura',border:'#f3a6c3',background:'linear-gradient(#4a2433,#1d0f15)',text:'#ffe3ee'},
 {id:'navy',name:'ネイビー',free:false,shopCode:'plate_navy',border:'#6a9bd1',background:'linear-gradient(#1d3554,#0c1828)',text:'#e3efff'},
];
export const THREAD_ITEMS:readonly ThreadItem[]=[
 {id:'standard',name:'標準',free:true},
 // Placeholders (CSS only) until Daniel's thread designs arrive.
 {id:'gold',name:'ゴールド',free:false,shopCode:'thread_gold',border:'2px solid #d9b45b',band:'linear-gradient(90deg,#d9b45b,#f5e1a4,#d9b45b)',badge:'GOLD',badgeColor:'#7a5a12'},
 {id:'silver',name:'シルバー',free:false,shopCode:'thread_silver',border:'2px solid #b9c2cc',band:'linear-gradient(90deg,#aeb7c1,#eef2f5,#aeb7c1)',badge:'SILVER',badgeColor:'#4a5560'},
 {id:'sakura',name:'桜',free:false,shopCode:'thread_sakura',border:'2px solid #f3a6c3',band:'linear-gradient(90deg,#f3a6c3,#ffe3ee,#f3a6c3)',badge:'SAKURA',badgeColor:'#9b3d62'},
 {id:'navy',name:'ネイビー',free:false,shopCode:'thread_navy',border:'2px solid #3d6b9a',band:'linear-gradient(90deg,#20476f,#4f86bd,#20476f)',badge:'NAVY',badgeColor:'#ffffff'},
];
/** Everyone may equip every placeholder on staging until sales start (mirrors poker_private.cosmetics_free_for_now()). */
export const COSMETICS_FREE_FOR_NOW=true;
export const COSMETIC_ITEMS:Record<CosmeticKind,readonly Base[]>={frame:FRAME_ITEMS,plate:PLATE_ITEMS,thread:THREAD_ITEMS};
// While paid features are hidden (lib/billing/visibility.ts), every equipped placeholder renders as 標準.
const find=<T extends Base>(list:readonly T[],code:string|null|undefined)=>paidFeaturesVisible()?list.find(i=>i.shopCode===code)??list[0]:list[0];
export const frameItem=(code?:string|null)=>find(FRAME_ITEMS,code);
export const plateItem=(code?:string|null)=>find(PLATE_ITEMS,code);
export const threadItem=(code?:string|null)=>find(THREAD_ITEMS,code);
export function cosmeticUnlocked(item:Base,owned:readonly string[],allFree=COSMETICS_FREE_FOR_NOW){return allFree||item.free||Boolean(item.shopCode&&owned.includes(item.shopCode));}
/** Style for the element around an avatar (outline sits outside, so inner rings/timers are untouched). */
/** glow=false on the tables: their rings already use filter/box-shadow for stamps and the turn light. */
export function frameStyle(code?:string|null,glow=true):CSSProperties|undefined{const f=frameItem(code);if(!f.outline&&!f.image)return undefined;return {outline:f.outline,outlineOffset:2,borderRadius:'50%',...(glow&&f.glow?{filter:`drop-shadow(${f.glow})`}:{})};}
/** Style for one part of a seat plate (name or chips). */
export function plateStyle(code?:string|null):CSSProperties|undefined{const p=plateItem(code);if(!p.border)return undefined;return {borderColor:p.border,background:p.background,color:p.text};}
/** Style for a thread card / header, plus its small badge. */
export function threadStyle(code?:string|null):{card?:CSSProperties;band?:CSSProperties;badge?:{text:string;style:CSSProperties}}{
 const t=threadItem(code);if(!t.border)return {};
 return {card:{border:t.border,borderRadius:10,overflow:'hidden'},band:{height:6,background:t.band},badge:t.badge?{text:t.badge,style:{display:'inline-block',marginLeft:6,padding:'0 6px',borderRadius:6,fontSize:10,fontWeight:800,letterSpacing:'.06em',background:t.band,color:t.badgeColor}}:undefined};
}
/** Equipped choice as sent in public profile data (shop codes, or null for standard). */
export type Equipped={frame:string|null;plate:string|null;thread:string|null};
export const validCode=(v:unknown,kind:CosmeticKind):string|null=>typeof v==='string'&&COSMETIC_ITEMS[kind].some(i=>i.shopCode===v)?v:null;
/** A thread card / header: border + a thin band across the top (as a background image, so the card's own layout is untouched). */
export function threadCardStyle(code?:string|null):CSSProperties|undefined{const t=threadItem(code);if(!t.border)return undefined;return {border:t.border,backgroundImage:t.band,backgroundSize:'100% 5px',backgroundRepeat:'no-repeat',backgroundPosition:'top'};}
