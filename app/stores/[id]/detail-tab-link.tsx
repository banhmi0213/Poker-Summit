"use client";
export function DetailTabLink({id}: {id:string}) {
 return <button className="sd-see-all" type="button" onClick={()=>window.dispatchEvent(new CustomEvent("store-detail-tab",{detail:id}))}>すべて見る ›</button>;
}
