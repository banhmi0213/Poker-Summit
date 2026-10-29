'use client';
import {useEffect,useMemo,useState} from 'react';
import {texture} from '@/lib/poker/flop-subset';
import styles from './gto-chart.module.css';
import {strategyColor} from './strategy-colors';
import {StrategyLegend} from './strategy-legend';

/** Whole-range strategy over every computed flop of a spot (2026/10/30, public/poker-gto/flops/aggregate.json):
 * averages by board type, weighted by how often each board occurs, and every flop sorted by how much it bets. */
type Row={flop:string;weight:number;version:number;first:Record<string,number>;afterCheck:Record<string,number>|null;ev?:{oop:number;ip:number};pot?:number};
type Aggregate=Record<string,{seats:string[];flops:Row[]}>;
let cache:Promise<Aggregate|null>|null=null;
const load=()=>cache??=fetch('/poker-gto/flops/aggregate.json').then(r=>r.ok?r.json() as Promise<Aggregate>:null).catch(()=>null);
const SUIT:Record<string,string>={c:'♣',d:'♦',h:'♥',s:'♠'};
const flopText=(f:string)=>[0,2,4].map(i=>f[i]+SUIT[f[i+1]]).join(' ');
const pct=(v:number)=>`${Math.round(v*100)}%`;
const kindOf=(label:string)=>label.startsWith('チェック')?'check':label.startsWith('オールイン')?'allin':label.startsWith('ベット')?'bet':label.startsWith('レイズ')?'raise':label.startsWith('コール')?'call':label.startsWith('フォールド')?'fold':'bet';
const sizeOf=(label:string)=>{const m=/([\d.]+)/.exec(label);return label.startsWith('オールイン')?1e9:m?Number(m[1]):0;};
/** Board types: a flop can be in several (e.g. "A high" and "two-tone"). */
const GROUPS:{label:string;test:(r:number[],pairing:number,pattern:string)=>boolean}[]=[
 {label:'Aハイ',test:r=>r[0]===14},{label:'Kハイ',test:r=>r[0]===13},{label:'Qハイ',test:r=>r[0]===12},{label:'J・Tハイ',test:r=>r[0]===11||r[0]===10},{label:'9以下のボード',test:r=>r[0]<=9},
 {label:'ペアボード',test:(_,p)=>p>0},{label:'モノトーン（3枚同じスート）',test:(_,__,s)=>s==='m'},{label:'2トーン（2枚同じスート）',test:(_,__,s)=>s!=='m'&&s!=='r'},{label:'レインボー（スートばらばら）',test:(_,__,s)=>s==='r'},
 {label:'つながったボード',test:(r,p)=>p===0&&r[0]-r[2]<=4},
];

function Bar({mix,labels}:{mix:Record<string,number>;labels:string[]}){
 const actions=labels.map(l=>({kind:kindOf(l),label:l}));let acc=0;
 const stops=labels.map((l,i)=>{const from=acc;acc+=(mix[l]??0)*100;return `${strategyColor(actions[i],actions)} ${from}% ${acc}%`;}).join(',');
 return <i role="cell" style={{background:`linear-gradient(90deg,${stops})`}} title={labels.map(l=>`${l} ${pct(mix[l]??0)}`).join('・')}/>;
}

export function FlopAggregate({spot,onPick}:{spot:string;onPick:(flop:string)=>void}){
 const [data,setData]=useState<Aggregate|null|undefined>(undefined),[side,setSide]=useState<'first'|'afterCheck'>('first'),[sort,setSort]=useState<'bet'|'check'|'board'>('bet');
 useEffect(()=>{void load().then(setData);},[]);
 const spotData=data?.[spot];
 const view=useMemo(()=>{
  if(!spotData)return null;
  const key:'first'|'afterCheck'=side,mixOf=(r:Row):Record<string,number>=>r[key]??{},rows=spotData.flops.filter((r:Row)=>r[key]);
  const labels:string[]=[...new Set<string>(rows.flatMap((r:Row)=>Object.keys(mixOf(r))))].sort((a:string,b:string)=>{const ka=kindOf(a),kb=kindOf(b),o=['check','fold','call','bet','raise','allin'];return o.indexOf(ka)-o.indexOf(kb)||sizeOf(a)-sizeOf(b);});
  const avg=(list:Row[])=>{const m:Record<string,number>={};let w=0;for(const r of list){w+=r.weight;for(const [l,v] of Object.entries(mixOf(r)))m[l]=(m[l]??0)+v*r.weight;}for(const l of Object.keys(m))m[l]/=w||1;return {mix:m,weight:w};};
  const all=avg(rows),groups=GROUPS.map(g=>{const list=rows.filter(r=>{const t=texture(r.flop);return t&&g.test(t.ranks,t.pairing,t.pattern);});return {label:g.label,count:list.length,...avg(list)};}).filter(g=>g.count>0);
  const betShare=(r:Row)=>1-(mixOf(r)['チェック']??0);
  const sorted=[...rows].sort((a,b)=>sort==='bet'?betShare(b)-betShare(a):sort==='check'?betShare(a)-betShare(b):0);
  return {labels,all,groups,sorted,total:rows.reduce((s,r)=>s+r.weight,0)};
 },[spotData,side,sort]);
 if(data===undefined)return <p role="status">読み込み中…</p>;
 if(!spotData||!view)return <p className={styles.note}>この場面のまとめはまだありません（計算中）。</p>;
 const who=side==='first'?`${spotData.seats[0]}（先に打つ人）`:`${spotData.seats[spotData.seats.length-1]}（チェックされたとき）`;
 return <div className={styles.wrap}>
  <div className={styles.form}>
   <label>見る人<select value={side} onChange={e=>setSide(e.target.value as 'first'|'afterCheck')}><option value="first">{spotData.seats[0]}（先に打つ人）</option>{spotData.seats.length===2&&<option value="afterCheck">{spotData.seats[1]}（チェックされたとき）</option>}</select></label>
   <label>並べ方<select value={sort} onChange={e=>setSort(e.target.value as 'bet'|'check'|'board')}><option value="bet">ベットが多い順</option><option value="check">チェックが多い順</option><option value="board">ボード順</option></select></label>
  </div>
  <p className={styles.note}>計算済み {spotData.flops.length}枚のフロップの、{who}のレンジ全体の打ち方です。平均は、それぞれのフロップが実際に出る回数（全22,100通りのうち似た形の数）で重みを付けています。</p>
  <StrategyLegend actions={view.labels.map(l=>({kind:kindOf(l),label:l}))}/>
  <div className={styles.cats} role="table" aria-label="ボードの形ごとの打ち方">
   <p className={styles.note}>ボードの形ごとの平均（右の数字は出る割合）</p>
   {[{label:'すべてのフロップ',count:spotData.flops.length,...view.all},...view.groups].map(g=><div key={g.label} className={styles.catRow} role="row"><span role="cell">{g.label}</span><small role="cell">{pct(g.weight/(view.total||1))}</small><Bar mix={g.mix} labels={view.labels}/></div>)}
  </div>
  <div className={styles.cats} role="table" aria-label="フロップごとの打ち方">
   <p className={styles.note}>フロップごと（右の数字はチェック以外を選ぶ割合。押すとそのフロップの手札ごとの表を開きます）</p>
   {view.sorted.map(r=><div key={r.flop} className={styles.catRow} role="row" tabIndex={0} onClick={()=>onPick(r.flop)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(r.flop);}}} style={{cursor:'pointer'}}><span role="cell">{flopText(r.flop)}</span><small role="cell">{pct(1-(r[side]!['チェック']??0))}</small><Bar mix={r[side]!} labels={view.labels}/></div>)}
  </div>
 </div>;
}
