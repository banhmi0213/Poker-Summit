"use client";
import NumberStepper from "./number-stepper";
import { useState } from "react";
import type { TournamentPrize } from "@/lib/poker/tournament";
export default function PrizeEditor({initial=[]}:{initial?:TournamentPrize[]}) {
 const [rows,setRows]=useState(initial);
 const patch=(i:number,p:Partial<TournamentPrize>)=>setRows(rows.map((r,j)=>i===j?{...r,...p}:r));
 return <fieldset style={{minWidth:0}}><legend>プライズ（順位ごと）</legend><input type="hidden" name="prizes" value={JSON.stringify(rows)}/>{rows.map((r,i)=><div key={i} style={{display:"grid",gap:8,padding:12,borderBottom:"1px solid #d7c9ad"}}><label>順位<NumberStepper label={`プライズ${i+1}の順位`} min={1} max={1000} increment={1} value={r.rank} onChange={rank=>patch(i,{rank})}/></label><label>種類<select value={r.kind} onChange={e=>patch(i,{kind:e.target.value as TournamentPrize["kind"],chips:0,description:""})}><option value="chips">チップ</option><option value="text">自由記載（ギフト券など）</option></select></label>{r.kind==="chips"?<label>付与予定チップ数<NumberStepper label={`プライズ${i+1}のチップ`} min={1} value={r.chips} onChange={chips=>patch(i,{chips})}/></label>:null}<label>{r.kind==="chips"?"補足（任意）":"プライズ内容"}<textarea required={r.kind==="text"} maxLength={500} value={r.description} onChange={e=>patch(i,{description:e.target.value})} placeholder={r.kind==="text"?"例：ギフト券 5,000円分":""}/></label><button type="button" className="btn" onClick={()=>setRows(rows.filter((_,j)=>j!==i))}>このプライズを削除</button></div>)}<button type="button" className="btn" disabled={rows.length>=100} onClick={()=>setRows([...rows,{rank:Math.max(0,...rows.map(r=>r.rank))+1,kind:"chips",chips:0,description:""}])}>＋ プライズを追加</button><p><small>チップの自動付与は大会結果・会員残高との連携後に対応します。現在は設定の保存・表示のみで、残高は変わりません。</small></p></fieldset>;
}
