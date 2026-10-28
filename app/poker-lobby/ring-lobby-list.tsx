'use client';
import {useMemo,useState,type ReactNode} from 'react';
import {LobbyIcon} from './lobby-icon';
import styles from './ring-lobby-list.module.css';

export type LobbyRingRow={id:string;title:string;sb:number;bb:number;capacity:number;minBuyIn:number;maxBuyIn:number;occupied:number|null};
export function RingLobbyList<T extends LobbyRingRow>({rows,renderActions,onRefresh,refreshing=false,unavailable=false}:{rows:T[];renderActions:(row:T)=>ReactNode;onRefresh?:()=>void;refreshing?:boolean;unavailable?:boolean}){
 const [rate,setRate]=useState('all'),[onlyAvailable,setOnlyAvailable]=useState(false),[page,setPage]=useState(0);
 const rates=useMemo(()=>[...new Map(rows.map(row=>[`${row.sb}/${row.bb}`,{key:`${row.sb}/${row.bb}`,label:`${row.sb} / ${row.bb}`}])).values()],[rows]);
 const filtered=rows.filter(row=>(rate==='all'||`${row.sb}/${row.bb}`===rate)&&(!onlyAvailable||row.occupied!==null&&row.occupied<row.capacity));
 const pages=Math.max(1,Math.ceil(filtered.length/5)),current=Math.min(page,pages-1);
 return <div className={styles.list}>
  <div className={styles.filters}><label><span className={styles.srOnly}>ブラインドで絞り込み</span><select value={rate} onChange={e=>{setRate(e.target.value);setPage(0);}}><option value="all">すべてのレート</option>{rates.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</select></label><label><span className={styles.srOnly}>空席で絞り込み</span><select value={onlyAvailable?'available':'all'} onChange={e=>{setOnlyAvailable(e.target.value==='available');setPage(0);}}><option value="all">すべての卓</option><option value="available">空席あり</option></select></label>{onRefresh&&<button type="button" className={styles.refresh} disabled={refreshing} onClick={onRefresh}>更新</button>}</div>
  <div role="table" aria-label="リング卓一覧" className={styles.table}>
   <div role="row" className={styles.head}><span role="columnheader">卓名</span><span role="columnheader">ブラインド</span><span role="columnheader">人数</span><span role="columnheader">持込チップ</span><span role="columnheader" className={styles.srOnly}>操作</span></div>
   {filtered.slice(current*5,current*5+5).map(row=><div role="row" className={styles.row} key={row.id}>
    <div role="cell" className={styles.name}><span className={styles.emblem}><LobbyIcon name="spade"/></span><strong>{row.title}</strong></div>
    <div role="cell" className={styles.blind}><small>ブラインド</small>{row.sb.toLocaleString()} / {row.bb.toLocaleString()}</div>
    <div role="cell" className={styles.players}><span>{row.occupied===null?'—':row.occupied} / {row.capacity}人</span><span className={styles.seats} aria-hidden="true">{Array.from({length:row.capacity},(_,i)=><i key={i} data-occupied={row.occupied!==null&&i<row.occupied}/>)}</span>{row.occupied!==null&&row.occupied>=row.capacity&&<small className={styles.full}>満席</small>}</div>
    <div role="cell" className={styles.buyIn}><small>持込チップ</small>{row.minBuyIn.toLocaleString()}<span>〜</span>{row.maxBuyIn.toLocaleString()}</div>
    <div role="cell" className={styles.actions}>{renderActions(row)}</div>
   </div>)}
  </div>
  {!filtered.length&&<p className={styles.empty} role="status">{unavailable?'卓設定を読み込めませんでした。時間をおいて更新してください。':rows.length?'条件に合う卓はありません。絞り込みを変更してください。':'現在、公開中のリング卓はありません。'}</p>}
  {pages>1&&<nav className={styles.pagination} aria-label="リング卓一覧のページ"><span>{filtered.length}卓中 {current*5+1}〜{Math.min(current*5+5,filtered.length)}卓</span><button type="button" disabled={current===0} onClick={()=>setPage(current-1)}>前へ</button><span>{current+1} / {pages}</span><button type="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>次へ</button></nav>}
 </div>;
}
