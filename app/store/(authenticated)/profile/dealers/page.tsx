import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { createStoreClient } from "@/lib/supabase/store-server";
import styles from "@/app/account/dealer/dealer.module.css";
export const dynamic="force-dynamic";
export default async function DealersPage(){
 const supabase=await createStoreClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/store/login?next=/store/profile/dealers");
 const {data:owned,error:ownedError}=await supabase.from("stores").select("id").eq("owner_user_id",user.id).limit(1).maybeSingle();
 if(ownedError||!owned)notFound();
 const {data:profiles,error}=await supabase.from("dealer_profiles").select("user_id,full_name,pref,games,experience_years,dealer_type").eq("published",true).order("updated_at",{ascending:false});
 if(error)throw new Error("ディーラー情報を読み込めませんでした。");
 return <main className={styles.page}><h1 className={styles.heading}>ディーラー</h1><p className={styles.hint}>店舗アカウント限定のプロフィールです。</p>{!profiles?.length && <p>登録されたディーラーはまだいません。</p>}<div className={styles.list}>{profiles?.map(p=><Link key={p.user_id} href={"/store/profile/dealers/"+p.user_id}><h2>{p.full_name}</h2><span className={styles.tag}>{p.dealer_type}</span><p>{p.pref}・経験{p.experience_years}年</p><p>{p.games.join("／")}</p><strong>プロフィールを見る →</strong></Link>)}</div></main>;
}
