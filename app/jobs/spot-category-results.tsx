import Link from "next/link";
import { openingEmptyNote } from "@/lib/prelaunch";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION, PRIVACY_VERSION, MATCHING_RULES_VERSION } from "@/lib/legal";
import { Restricted } from "@/app/spot-jobs/detail";
import { ReadableName } from "@/app/readable-name";

// Never load restricted listings before dealer eligibility and current consent are checked.
export async function SpotCategoryResults({pref,q,employmentFilter}:{pref:string;q:string;employmentFilter:string}) {
  const db = await createClient();
  const {data:{user}} = await db.auth.getUser();
  const destination = "/spot-jobs?" + new URLSearchParams({pref,sort:"new"});
  let notice;
  if (!user) notice = <Restricted loggedIn={false}/>;
  else {
    const [dealer,suspended,consent] = await Promise.all([
      db.from("dealer_profiles").select("user_id").eq("user_id",user.id).maybeSingle(),
      db.rpc("is_suspended"),
      db.from("user_legal_consents").select("id").eq("user_id",user.id).eq("scope","matching_dealer").eq("terms_version",TERMS_VERSION).eq("privacy_version",PRIVACY_VERSION).eq("rules_version",MATCHING_RULES_VERSION).maybeSingle(),
    ]);
    if (dealer.error || suspended.error || consent.error) throw new Error("スポット求人の閲覧権限を確認できませんでした。");
    if (!dealer.data || suspended.data) notice = <Restricted/>;
    else if (!consent.data) notice = <p>スポット求人の閲覧には利用規約への同意が必要です。<Link href={destination}>同意してスポット求人を見る</Link></p>;
  }
  if (notice) return <section style={{marginTop:24}}><h2 style={{fontSize:18}}>スポット</h2>{notice}</section>;
  // Spot contracts have their own employment/contract terms, never classify them as permanent jobs.
  if (employmentFilter) return <section style={{marginTop:24}}><h2 style={{fontSize:18}}>スポット</h2><p className="muted">スポット求人を表示するには、雇用形態を「すべて」にしてください。</p></section>;
  const now = new Date();
  const jst = new Date(now.getTime()+9*3600000).toISOString();
  let query = db.from("spot_jobs").select("id,duties,created_at,stores!inner(name,pref),spot_job_shifts!inner(work_date,start_time)").eq("published",true).gt("deadline",now.toISOString())
    .or(`work_date.gt.${jst.slice(0,10)},and(work_date.eq.${jst.slice(0,10)},start_time.gt.${jst.slice(11,19)})`,{referencedTable:"spot_job_shifts"})
    .order("created_at",{ascending:false});
  if(pref) query=query.eq("stores.pref",pref);
  if(q) query=query.ilike("duties",`%${q}%`);
  const {data,error}=await query;
  if(error) throw new Error("スポット求人を読み込めませんでした。");
  return <section style={{marginTop:24}}><h2 style={{fontSize:18}}>スポット <small className="muted">新着順</small></h2>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}}>{(data??[]).map((job:any)=><Link className="card" key={job.id} href={`/spot-jobs/${job.id}`}><span className="badge outline">スポット</span><h3><ReadableName name={job.stores?.name??""}/></h3><p className="muted">{job.stores?.pref}</p><p>{job.duties}</p><span>募集詳細を見る</span></Link>)}</div>
    {!data?.length&&<p className="empty">条件に合うスポット求人が見つかりませんでした。{openingEmptyNote("スポット求人") && <><br />{openingEmptyNote("スポット求人")}</>}</p>}
  </section>;
}
