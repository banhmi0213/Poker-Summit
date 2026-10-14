"use client";
import { useState } from "react";
export function JobCategoryFilter({ selected }: { selected: string }) {
  const [value, setValue] = useState(selected);
  return <fieldset style={{border:0,padding:0,margin:0,flexBasis:"100%"}}>
    <legend style={{fontWeight:700,fontSize:13,marginBottom:8}}>職種</legend>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      {["", "ディーラー", "ホールスタッフ"].map(role=><label key={role} className={value===role?"btn primary":"btn"} style={{display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer"}}>
        <input type="radio" name="role" value={role} checked={value===role} onChange={()=>setValue(role)}/>{role||"すべて"}
      </label>)}
    </div>
  </fieldset>;
}
