'use client';
import {useEffect,useState} from 'react';
import styles from './gto-chart.module.css';

/** Precomputed flop solutions (scripts/poker-gto/flop-solve.cjs → public/poker-gto/flops/<flop>.json). */
type FlopNode={path:number[];player:0|1;actions:{label:string;kind:string}[];total:number[];classes:Record<string,number[]>;children:(number|null)[]};
type FlopData={flop:string;spot:{name:string;pot:number;stack:number;oop:string;ip:string};iterations:number;exploitability:number;nodes:FlopNode[]};
export const FLOPS=['Ah7d2c','AhKd5c','AhJd8c','Ah5d4c','AhAd7c','Kh7d2c','KhQd6c','KhTd9c','Kh8d8c','Qh8d3c','QhJdTc','Qh9d5c','Jh8d4c','JhTd7c','Th9d6c',
 'Th7d3c','9h5d2c','8h7d5c','6h5d4c','5h4d2c','7h7d2c','QhQd5c','AhTh4c','Kh9h3c','Jh9h5c','8h6h4c','KhTh4h','7h5h2h','AhQhJh','9h8h3c'];
const R='AKQJT98765432',SUIT:Record<string,string>={c:'♣',d:'♦',h:'♥',s:'♠'};
const label=(i:number,j:number)=>i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o';
const flopText=(f:string)=>[0,2,4].map(i=>f[i]+SUIT[f[i+1]]).join(' ');
const COLORS:Record<string,string>={check:'#4f8f74',call:'#4f8f74',fold:'#5a6b78',bet:'#d9b368',raise:'#d0784f',allin:'#b04a4a'};
const pct=(v:number)=>`${Math.round(v*100)}%`;

export function FlopStrategyPanel({flops=FLOPS}:{flops?:string[]}){
 const [flop,setFlop]=useState(flops[0]);
 const [data,setData]=useState<FlopData|null>(null),[error,setError]=useState('');
 const [trail,setTrail]=useState<number[]>([0]);
 useEffect(()=>{let live=true;setData(null);setError('');setTrail([0]);
  fetch(`/poker-gto/flops/${flop}.json`).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json();}).then(d=>{if(live)setData(d);}).catch(()=>{if(live)setError('このフロップの計算結果を読み込めませんでした。');});
  return ()=>{live=false;};},[flop]);
 const node=data?data.nodes[trail[trail.length-1]]:null;
 const who=(p:0|1)=>p===0?`${data!.spot.oop}（先に打つ人）`:`${data!.spot.ip}（後に打つ人）`;
 return <div className={styles.wrap}>
  <p>よくあるフロップを前もって計算した、フロップでの正解の打ち方です。BTNが2.5BBでオープン、BBがコールした100BBのポット（ポット5.5BB）を、ターン・リバーのカードまで全部計算しています。</p>
  <p className={styles.note}>ベット額の前提：フロップはポットの33%・75%と3倍レイズ、ターンは66%、リバーは75%（オールインはポットの1.5倍以内のときだけ）。お互いのレンジは標準的な目安レンジです。</p>
  <label className={styles.stack}>フロップを選ぶ<select value={flop} onChange={e=>setFlop(e.target.value)}>{flops.map(f=><option key={f} value={f}>{flopText(f)}</option>)}</select></label>
  {error&&<p role="alert">{error}</p>}
  {!data&&!error&&<p role="status">読み込み中…</p>}
  {data&&node&&<>
   <p className={styles.note}>ボード {flopText(data.flop)} ・ {data.iterations}回計算 ・ 正解からのズレ：ポットの{data.exploitability.toFixed(2)}%</p>
   <nav className={styles.path} aria-label="場面を選ぶ">
    <button type="button" onClick={()=>setTrail([0])} disabled={trail.length===1}>最初から</button>
    {trail.length>1&&<button type="button" onClick={()=>setTrail(t=>t.slice(0,-1))}>1つ戻る</button>}
    {trail.slice(1).map((n,i)=>{const parent=data.nodes[trail[i]],a=parent.children.indexOf(n);return <span key={i}>{parent.player===0?data.spot.oop:data.spot.ip} {parent.actions[a].label}</span>;})}
   </nav>
   <p><b>{who(node.player)}の番</b>：全体では {node.actions.map((a,i)=>`${a.label} ${pct(node.total[i])}`).join('・')}</p>
   <div className={styles.path}>{node.actions.map((a,i)=>node.children[i]!==null?<button key={i} type="button" onClick={()=>setTrail(t=>[...t,node.children[i]!])}>「{a.label}」の後を見る</button>:null)}</div>
   <table className={styles.grid} aria-label="手札ごとの打ち方"><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{const l=label(i,j),e=node.classes[l];if(!e||e[0]<=0)return <td key={j} data-on="none">{l}</td>;
    let acc=0;const stops=node.actions.map((a,ai)=>{const from=acc;acc+=e[ai+1]*100;return `${COLORS[a.kind]} ${from}% ${acc}%`;}).join(',');
    return <td key={j} data-on="mix" style={{background:`linear-gradient(90deg,${stops})`}} title={`${l}：${node.actions.map((a,ai)=>`${a.label} ${pct(e[ai+1])}`).join('・')}`}>{l}</td>;})}</tr>)}</tbody></table>
   <p className={styles.legend}>{node.actions.map((a,i)=><em key={i} className={styles.key}><i style={{background:COLORS[a.kind]}}/>{a.label}</em>)} 色の割合＝その手でその打ち方をする割合。灰色の枠はこの場面に来ない手。</p>
  </>}
 </div>;
}
