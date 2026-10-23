'use client';
import {useLayoutEffect,useRef,type RefObject} from 'react';
import {tableMotionEvents,type TableMotionFrame} from '@/lib/poker/table-motion';
import styles from './table-action-motion.module.css';
type Point={x:number;y:number};
type Geometry={holes:Map<string,Point[]>;bets:Map<string,Point>;stacks:Map<string,Point>};
/** Isolated animation layer: actual cards/chips and authority are never moved. */
export function TableMotionLayer(){return <><span data-motion-origin className={styles.origin} aria-hidden="true"/><div data-motion-layer className={styles.layer} aria-hidden="true"/></>;}
export function useTableActionMotion(ref:RefObject<HTMLDivElement>,frame:TableMotionFrame|null){
 const prior=useRef<TableMotionFrame|null>(null),geometry=useRef<Geometry>({holes:new Map(),bets:new Map(),stacks:new Map()}),running=useRef(new Set<()=>void>()),capture=useRef<(()=>void)|null>(null);
 const stamp=JSON.stringify(frame);
 useLayoutEffect(()=>{
  const root=ref.current,layer=root?.querySelector<HTMLElement>('[data-motion-layer]');if(!root||!layer)return;
  const stop=()=>{for(const cancel of [...running.current])cancel();};
  const bounds=root.getBoundingClientRect(),sx=bounds.width/(root.offsetWidth||bounds.width),sy=bounds.height/(root.offsetHeight||bounds.height);
  if(!sx||!sy)return;
  const center=(node:Element):Point=>{const r=node.getBoundingClientRect();return {x:(r.left+r.width/2-bounds.left)/sx-root.clientLeft,y:(r.top+r.height/2-bounds.top)/sy-root.clientTop};};
  const collect=():Geometry=>{const g:Geometry={holes:new Map(),bets:new Map(),stacks:new Map()};
   root.querySelectorAll<HTMLElement>('[data-motion-hole]').forEach(n=>g.holes.set(n.dataset.motionHole!,Array.from(n.children).map(center)));
   root.querySelectorAll<HTMLElement>('[data-motion-bet]').forEach(n=>g.bets.set(n.dataset.motionBet!,center(n)));
   root.querySelectorAll<HTMLElement>('[data-motion-stack]').forEach(n=>g.stacks.set(n.dataset.motionStack!,center(n)));return g;};
  const current=collect(),old=geometry.current,events=tableMotionEvents(prior.current,frame);
  if(!frame||prior.current?.handId!==frame.handId)stop();
  prior.current=frame?structuredClone(frame):null;geometry.current=current;
  // Re-measure on the next state transition; never finish a flight at obsolete
  // viewport coordinates after scrolling/resizing the table.
  capture.current=()=>{geometry.current={holes:new Map(),bets:new Map(),stacks:new Map()};};
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const originNode=root.querySelector('[data-motion-origin]'),potNode=root.querySelector('[data-pot-source]');if(!originNode||!potNode)return;
  const origin=center(originNode),pot=center(potNode),muck={x:pot.x-44,y:pot.y-28};
  const track=(node:HTMLElement,frames:Keyframe[],options:KeyframeAnimationOptions,remove=false)=>{
   if(typeof node.animate!=='function'){if(remove)node.remove();return;}
   let animation:Animation;try{animation=node.animate(frames,options);}catch{if(remove)node.remove();return;}
   const clean=()=>{running.current.delete(clean);animation.cancel();if(remove)node.remove();};running.current.add(clean);void animation.finished.then(clean,clean);
  };
  const ghost=(kind:'card'|'chip',start:Point,end:Point,delay:number,duration:number,turn=0)=>{
   if(running.current.size>120)return;const node=document.createElement('span');node.className=kind==='card'?styles.flyingCard:styles.chip;node.dataset.motionGhost=kind;
   node.style.left=`${start.x-(kind==='card'?15:8.5)}px`;node.style.top=`${start.y-(kind==='card'?21:8.5)}px`;
   if(kind==='card'){const img=document.createElement('img');img.src='/images/summit-finger-clean.webp';img.alt='';img.className=styles.mark;node.append(img);}else node.textContent='♠';layer.append(node);
   const dx=end.x-start.x,dy=end.y-start.y,final=`translate(${dx}px,${dy}px) rotate(${turn}deg)`;
   track(node,[{offset:0,transform:'translate(0,0) rotate(-8deg)',opacity:0},{offset:.07,transform:'translate(0,0) rotate(-8deg)',opacity:1},{offset:.82,transform:final,opacity:1},{offset:1,transform:final,opacity:0}],{duration,delay,easing:'cubic-bezier(.2,.65,.3,1)',fill:'both'},true);
  };
  for(const e of events){
   if(e.kind==='deal'&&e.player!==undefined){const cards=root.querySelector<HTMLElement>(`[data-motion-hole="${e.player}"]`),target=current.holes.get(e.player)?.[e.index!];if(!target||!cards)continue;
    ghost('card',origin,target,e.delay??0,350,(e.index??0)===0?-4:4);const card=cards.children[e.index!] as HTMLElement;if(card)track(card,[{opacity:0,transform:'rotateY(85deg) scale(.92)'},{opacity:1,transform:'none'}],{duration:170,delay:(e.delay??0)+290,fill:'backwards',easing:'ease-out'});
   }else if(e.kind==='fold'&&e.player!==undefined){const points=current.holes.get(e.player)??old.holes.get(e.player)??[];points.slice(0,2).forEach((p,i)=>ghost('card',p,{x:muck.x+i*5,y:muck.y+i*3},i*40,420,i===0?-24:18));
   }else if((e.kind==='bet'||e.kind==='collect')&&e.player!==undefined){const start=e.kind==='bet'?(current.stacks.get(e.player)??old.stacks.get(e.player)):(old.bets.get(e.player)??current.bets.get(e.player));const end=e.kind==='collect'?pot:(current.bets.get(e.player)??{x:pot.x+(start&&start.x<pot.x?-35:35),y:pot.y+25});if(!start)continue;
    for(let i=0;i<3;i++)ghost('chip',{x:start.x+i*3,y:start.y-i*2},end,(e.delay??0)+i*45,360,i*35);
   }else if(e.kind==='board'){const cards=root.querySelector('[data-motion-board]'),card=cards?.children[e.index!] as HTMLElement|undefined;if(!card)continue;const end=center(card),dx=origin.x-end.x,dy=origin.y-end.y;
    track(card,[{transform:`translate(${dx}px,${dy}px) rotateY(85deg) scale(.85)`,opacity:0},{transform:'translate(0,0) rotateY(0) scale(1)',opacity:1}],{duration:380,delay:e.delay??0,easing:'cubic-bezier(.18,.7,.25,1)',fill:'backwards'});
   }
  }
 },[ref,stamp]);
 useLayoutEffect(()=>{if(typeof window==='undefined'||!ref.current)return;const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');const stop=()=>{for(const cancel of [...running.current])cancel();capture.current?.();};window.addEventListener('resize',stop);window.addEventListener('scroll',stop,true);media?.addEventListener?.('change',stop);return()=>{stop();prior.current=null;window.removeEventListener('resize',stop);window.removeEventListener('scroll',stop,true);media?.removeEventListener?.('change',stop);};},[ref]);
}
