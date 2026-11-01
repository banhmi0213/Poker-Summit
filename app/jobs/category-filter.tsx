"use client";
import { useState } from "react";

// 職種の絞り込み: 3つを1行に、文字数に合わせた幅で並べる(スマホで「ホールスタッフ」だけ2段目に落ちないように)
export function JobCategoryFilter({ selected }: { selected: string }) {
  const [value, setValue] = useState(selected);
  return <fieldset className="job-role-filter">
    <legend>職種</legend>
    <div>
      {["", "ディーラー", "ホールスタッフ"].map(role=><label key={role} className={value===role?"btn primary":"btn"}>
        <input type="radio" name="role" value={role} checked={value===role} onChange={()=>setValue(role)}/>{role||"すべて"}
      </label>)}
    </div>
  </fieldset>;
}
