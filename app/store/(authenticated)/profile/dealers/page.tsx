import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { createStoreClient } from "@/lib/supabase/store-server";
import { PREF_OPTIONS } from "@/lib/constants";
import styles from "@/app/account/dealer/dealer.module.css";
export const dynamic="force-dynamic";
export default async function DealersPage({searchParams}:{searchParams:{pref?:string;date?:string}}){
 const supabase=await createStoreClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/store/login?next=/store/profile/dealers");
 const {data:owned,error:ownedError}=await supabase.from("stores").select("id").eq("owner_user_id",user.id).limit(1).maybeSingle();
 if(ownedError||!owned)notFound();
 const pref=PREF_OPTIONS.includes(searchParams.pref ?? "") ? searchParams.pref! : "";
 const rawDate=searchParams.date ?? "";
 const date=/^\d{4}-\d{2}-\d{2}$/.test(rawDate)&&Number.isFinite(Date.parse(rawDate+"T00:00:00Z"))&&new Date(rawDate+"T00:00:00Z").toISOString().slice(0,10)===rawDate ? rawDate : "";
 let query=supabase.from("dealer_profiles").select("user_id,full_name,pref,games,experience_years,dealer_type,available_dates").eq("published",true).order("updated_at",{ascending:false});
 if(pref)query=query.eq("pref",pref);
 if(date)query=query.contains("available_dates",[date]);
 const {data:profiles,error}=await query;
 if(error)throw new Error("ディーラー情報を読み込めませんでした。");
 return <main className={styles.page}><h1 className={styles.heading}>ディーラー</h1><p className={styles.hint}>店舗アカウント限定のプロフィールです。</p><form action="/store/profile/dealers" className={styles.searchForm}><label className={styles.field}>都道府県<select name="pref" defaultValue={pref}><option value="">全国</option>{PREF_OPTIONS.map(p=><option key={p}>{p}</option>)}</select></label><label className={styles.field}>勤務希望日<input type="date" name="date" defaultValue={date}/></label><button className="btn primary" type="submit">検索</button><Link className="btn" href="/store/profile/dealers">条件を解除</Link></form>{!profiles?.length && <p>条件に一致するディーラーはいません。</p>}<div className={styles.list}>{profiles?.map(p=><Link key={p.user_id} href={"/store/profile/dealers/"+p.user_id}><h2>{p.full_name}</h2><span className={styles.tag}>{p.dealer_type}</span><p>{p.pref}・経験{p.experience_years}年</p><p>{p.games.join("／")}</p><strong>プロフィールを見る →</strong></Link>)}</div></main>;
}
