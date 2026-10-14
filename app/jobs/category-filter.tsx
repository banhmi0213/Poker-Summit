"use client";
import { useState } from "react";
import { JOB_FILTERS } from "@/lib/job-categories";
export function JobCategoryFilter({ selected }: { selected: string[] }) {
  const [values, setValues] = useState(selected);
  return <fieldset style={{border:0,padding:0,margin:0,flexBasis:"100%"}}>
    <legend style={{fontWeight:700,fontSize:13,marginBottom:8}}>求人の種類 <small className="muted">複数選択可</small></legend>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <button type="button" className={values.length ? "btn" : "btn primary"} aria-pressed={!values.length} onClick={()=>setValues([])}>すべて</button>
      {JOB_FILTERS.map(category=><label key={category} className={values.includes(category)?"btn primary":"btn"} style={{display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer"}}>
        <input type="checkbox" name="category" value={category} checked={values.includes(category)} onChange={e=>setValues(previous=>e.target.checked?[...previous,category]:previous.filter(v=>v!==category))}/>{category}
      </label>)}
    </div>
  </fieldset>;
}
