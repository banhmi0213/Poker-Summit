import Link from "next/link";
export function JobTypeTabs({active}:{active:"regular"|"spot"}){
 return <nav aria-label="求人の種類" style={{display:"flex",gap:10,flexWrap:"wrap",margin:"20px 0"}}>
 <Link href="/jobs" className={active==="regular"?"btn primary":"btn"} aria-current={active==="regular"?"page":undefined}>新着求人</Link>
 <Link href="/spot-jobs" className={active==="spot"?"btn primary":"btn"} aria-current={active==="spot"?"page":undefined}>スポット求人</Link>
 </nav>;
}
