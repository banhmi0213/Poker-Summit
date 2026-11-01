import {DealerReviews} from "@/app/account/dealer/reviews";
import {OfferForm} from "@/app/matching/chat/forms";
import {DirectOfferForm} from "@/app/matching/chat/direct-offer-form";
import {CancellationHistory,type CancelHistory} from "@/app/matching/work/cancellation-history";
import {latestSpotTemplate} from "@/lib/spot-jobs-server";
import {japanToday} from "@/lib/spot-jobs";
import { dealerReliability } from "@/lib/dealer-reliability";
import { DealerReliabilityView } from "@/app/account/dealer/reliability";
import { requireMatchingConsent } from "@/lib/matching-consent-server";
import { matchingReturnWithQuery } from "@/lib/matching-return";
import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { createStoreClient } from "@/lib/supabase/store-server";
import { DealerDetail } from "@/app/account/dealer/detail";
import styles from "@/app/account/dealer/dealer.module.css";
import { getStorePlan, spotMonthlyLimitOf, planQuotaUsedThisMonth } from "@/lib/plan-entitlements";
export const dynamic="force-dynamic";
export default async function DealerPage({params,searchParams}:{params:{id:string};searchParams:{reviews?:string}}){
 const supabase=await createStoreClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/store/login?next=/store/profile/dealers");
 if(!/^[0-9a-f-]{36}$/i.test(params.id))notFound();
 const {data:owned,error:ownedError}=await supabase.from("stores").select("id").eq("owner_user_id",user.id).limit(1).maybeSingle();
 if(ownedError||!owned)notFound();
 await requireMatchingConsent(supabase,user.id,"store","/store/profile/dealers/"+params.id);
 const [profile,address]=await Promise.all([supabase.from("dealer_profiles").select("*").eq("user_id",params.id).eq("published",true).maybeSingle(),supabase.from("dealer_addresses").select("address").eq("user_id",params.id).maybeSingle()]);
 if(profile.error||address.error)throw new Error("プロフィールを読み込めませんでした。");
 if(!profile.data)notFound();
 const stats=await dealerReliability(supabase,[params.id]);
 const {data:contracts,error:contractsError}=await supabase.from("dealer_matching_records").select("id").eq("dealer_user_id",params.id).in("status",["confirmed","completed"]);
 if(contractsError)throw new Error("契約情報を読み込めませんでした。");
 let contact: {phone:string;contact_type:string;contact_value:string}|null=null;
 for(const contract of contracts ?? []){
  const result=await supabase.rpc("get_matching_dealer_contacts",{p_record_id:contract.id});
  if(result.error)throw new Error("連絡先を確認できませんでした。");
  if(result.data?.length){contact=result.data[0];break;}
 }
 const {data:jobs,error:jobsError}=await supabase.from("spot_jobs").select("id,store_id,spot_job_shifts(work_date,start_time,end_time)").eq("store_id",owned.id).eq("published",true).gt("deadline",new Date().toISOString());
 if(jobsError)throw new Error("募集を読み込めませんでした。");
 const options=(jobs||[]).flatMap(j=>(j.spot_job_shifts||[]).filter(s=>Date.parse(s.work_date+"T"+s.start_time+"+09:00")>Date.now()).map(s=>({value:j.id+"|"+s.work_date,label:s.work_date+" "+s.start_time.slice(0,5)+"〜"+s.end_time.slice(0,5)+"（日本時間）"}))).sort((a,b)=>a.label.localeCompare(b.label));
 const {data:scoutCredit,error:scoutCreditError}=await supabase.from("store_scout_credits").select("balance").eq("store_id",owned.id).maybeSingle();
 if(scoutCreditError)throw new Error("スカウト枠を読み込めませんでした。");
 const scoutBalance=scoutCredit?.balance ?? 0;
 // プランの回数(スポット求人の公開・スカウト共通、2026/10/22〜)。先にプランの回数を使い、なくなったらスカウト枠を使う
 const plan=await getStorePlan(supabase,owned.id);
 const planLimit=spotMonthlyLimitOf(plan);
 const planLeft=planLimit===null?null:planLimit>0?Math.max(0,planLimit-await planQuotaUsedThisMonth(supabase,owned.id)):0;
 // 求人なしで直接オファーできる勤務日(今日〜2日後)と、前回の入力内容
 const today=japanToday();
 const offerDates={min:today,max:new Date(Date.parse(today+"T00:00:00Z")+365*86400000).toISOString().slice(0,10)};
 const template=await latestSpotTemplate(supabase,owned.id);
 const {data:cancelData}=await supabase.rpc("get_cancellation_history",{p_dealer:params.id});
 const photo=profile.data.photo_url ? "/store/profile/dealers/"+params.id+"/photo" : null;
 return <main className={styles.page}><Link href="/store/profile/dealers">ディーラー一覧に戻る</Link><h1 className={styles.heading}>ディーラー詳細</h1><DealerReliabilityView stats={stats[params.id]} /><CancellationHistory history={(cancelData as CancelHistory|null)??null} subject="dealer"/><DealerReviews db={supabase} id={params.id} page={parseInt(searchParams.reviews||"1",10)} path={"/store/profile/dealers/"+params.id}/><DealerDetail profile={profile.data} address={address.data?.address ?? ""} photo={photo}/><section className={styles.card}><h2 style={{fontSize:18}}>勤務をオファーする</h2><p>{planLeft===null?<>ご契約プランでスカウトは<strong>無制限</strong>です。</>:<>{planLimit!==0&&<>今月のプランの残り：<strong>{planLeft}回</strong>　／　</>}スカウトの残り：<strong>{scoutBalance}回分</strong>　<Link href="/store/profile/plan#addons">ディーラースカウトを購入する</Link></>}</p><p className={styles.hint}>新規の勤務オファーは、ディーラー1人・勤務日1日につき1回使います（同じディーラーに3日頼む場合は3回）。{planLimit!==0&&planLeft!==null?"先にプランの回数（スポット求人の公開と共通）を使い、なくなったら購入したスカウトの回数を使います。":""}既存の応募・オファーのチャットを開く場合は使いません。採用・勤務の成立は保証されません。</p><DirectOfferForm dealer={params.id} dates={offerDates} template={template}/>{options.length>0&&<details style={{marginTop:12}}><summary style={{cursor:"pointer"}}>公開中のスポット求人の日でオファーする</summary><OfferForm dealer={params.id} options={options}/><p className={styles.hint}>既に応募・オファーがある勤務日は、同じチャットを開きます。</p></details>}</section><section className={styles.card}><h2 style={{fontSize:18}}>契約成立後の連絡先</h2>{contact ? <dl className={styles.facts}><div><dt>電話番号</dt><dd>{contact.phone}</dd></div><div><dt>{contact.contact_type==="line" ? "LINE" : "メールアドレス"}</dt><dd>{contact.contact_value}</dd></div></dl> : <p className={styles.hint}>双方が勤務条件を確定し、ディーラーが開示に同意した場合に、この店舗だけに表示されます。</p>}</section></main>;
}


