import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createStoreClient} from "@/lib/supabase/store-server";
import {dealerAccess} from "@/lib/spot-jobs-server";
import {requireMatchingConsent} from "@/lib/matching-consent-server";
import {PortalHeader} from "@/app/portal-header";
import {PortalFooter} from "@/app/portal-footer";
import {WorkForm} from "./form";
import {UUID} from "@/lib/spot-jobs";
import styles from "@/app/spot-jobs/spot.module.css";
type Params={page?:string;job?:string;saved?:string;record?:string};
type RecordRow={id:string;spot_job_id:string|null;work_start:string;work_end:string;status:string;store_confirmed_at:string|null;dealer_confirmed_at:string|null;store_completed_at:string|null;dealer_completed_at:string|null;dealer_review:string|null;review_saved_at:string|null;store_review:string|null;store_review_saved_at:string|null;job_snapshot:{store_name?:string;dealer_name?:string;hourly_wage?:number;games?:string[];duties?:string;requirements?:string;dress?:string;transport_type?:string;transport_limit?:number}};
const date=(s:string)=>new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",dateStyle:"medium",timeStyle:"short"}).format(new Date(s));
export async function WorkPage({actor,searchParams}:{actor:"store"|"dealer";searchParams:Params}){
 const path=actor==="dealer"?"/account/dealer/work":"/store/profile/spot-jobs/work";
 const db=actor==="store"?await createStoreClient():(await dealerAccess(path)).db;
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect(actor==="store"?"/store/login":"/login");
 if(actor==="dealer"){const {data,error}=await db.from("dealer_profiles").select("user_id").eq("user_id",user.id).maybeSingle();if(error)throw new Error("登録を確認できませんでした。");if(!data)notFound();}
 await requireMatchingConsent(db,user.id,actor,path);
 let query=db.from("dealer_matching_records").select("*",{count:"exact"});
 if(actor==="store"){
  const {data,error}=await db.from("stores").select("id").eq("owner_user_id",user.id);
  if(error)throw new Error("店舗を確認できませんでした。");
  if(!data?.length)notFound();
  query=query.in("store_id",data.map(s=>s.id));
 }else query=query.eq("dealer_user_id",user.id);
 if(searchParams.job){if(!UUID.test(searchParams.job))notFound();query=query.eq("spot_job_id",searchParams.job);}
 if(searchParams.record){if(!UUID.test(searchParams.record))notFound();query=query.eq("id",searchParams.record);}
 const page=Math.max(1,Math.min(10000,parseInt(searchParams.page||"1",10)||1));
 const {data,error,count}=await query.order("work_start",{ascending:false}).order("id").range((page-1)*6,page*6-1);
 if(error)throw new Error("勤務履歴を読み込めませんでした。");
 const url=(p:number)=>path+"?"+new URLSearchParams({page:String(p),...(searchParams.job?{job:searchParams.job}:{})});
 const content=<main className={actor==="store"?styles.manage:styles.public}><Link href={actor==="store"?"/store/profile/spot-jobs":"/account/dealer"}>← {actor==="store"?"スポット求人管理":"ディーラープロフィール"}に戻る</Link><h1>勤務管理・履歴</h1><p className={styles.muted}>店舗とディーラーの両方が勤務完了を確認すると、勤務回数に反映されます。ディーラーから店舗へのレビューは求人履歴に、店舗からディーラーへのレビューはディーラーの勤務実績に残ります。</p>{searchParams.saved&&<p className={styles.success} role="status">保存しました。</p>}
 {(searchParams.job||searchParams.record)&&<p><Link href={path}>すべての勤務を表示</Link></p>}
 {(data as RecordRow[]||[]).map(r=>{
 const j=r.job_snapshot||{},ended=Date.parse(r.work_end)<=Date.now(),selfConfirmed=actor==="store"?r.store_confirmed_at:r.dealer_confirmed_at,selfCompleted=actor==="store"?r.store_completed_at:r.dealer_completed_at,selfReviewSaved=actor==="store"?r.store_review_saved_at:r.review_saved_at,selfReview=actor==="store"?r.store_review:r.dealer_review;
 const status=r.status==="pending"?"条件確認中":r.status==="completed"?"勤務完了":r.status==="confirmed"?(selfCompleted?"相手の完了確認待ち":"勤務確定"):"キャンセル・確認対応中";
 return <section className={styles.box} key={r.id}><span className={styles.tag}>{status}</span><h2>{actor==="store"?j.dealer_name||"ディーラー":j.store_name||"店舗"}</h2><p><strong>{date(r.work_start)} 〜 {date(r.work_end)}</strong>（日本時間）</p><p>時給：{j.hourly_wage!==undefined?"¥"+Number(j.hourly_wage).toLocaleString():"記録なし"} ／ 交通費：{j.transport_type==="full"?"全額支給":j.transport_type==="limited"?"上限 ¥"+Number(j.transport_limit||0).toLocaleString():j.transport_type==="none"?"支給なし":"記録なし"}</p>
 <details><summary>当時のスポット求人条件</summary><p>{j.games?.join("・")}</p><p className={styles.pre}>{j.duties||"条件の記録なし"}</p><p className={styles.pre}>応募条件：{j.requirements||"記載なし"}</p><p className={styles.pre}>服装・持ち物：{j.dress||"記載なし"}</p></details>
 {r.spot_job_id&&<p><Link href={path+"?job="+r.spot_job_id}>この求人の勤務履歴・レビュー</Link></p>}
 <p className={styles.muted}>条件確定：店舗 {r.store_confirmed_at?"確認済み":"未確認"} ／ ディーラー {r.dealer_confirmed_at?"確認済み":"未確認"}</p>
 <p><Link className={styles.button} href={(actor==="store"?"/store/profile/dealer-chat/":"/account/dealer/chat/")+r.id}>チャット・勤務条件の確認</Link></p>
 {r.status==="pending"&&selfConfirmed&&<p>相手の条件確定をお待ちください。</p>}
 {r.dealer_review&&<div style={{background:"#faf7ef",padding:16,borderRadius:8,margin:"16px 0"}}><strong>ディーラーから店舗へのレビュー</strong><p className={styles.pre}>{r.dealer_review}</p><small>{r.review_saved_at?date(r.review_saved_at):""}</small></div>}
 {!searchParams.job&&r.store_review&&<div style={{background:"#faf7ef",padding:16,borderRadius:8,margin:"16px 0"}}><strong>店舗からディーラーへのレビュー（勤務実績）</strong><p className={styles.pre}>{r.store_review}</p><small>{r.store_review_saved_at?date(r.store_review_saved_at):""}</small></div>}
 {r.status==="confirmed"&&ended&&!selfCompleted&&<WorkForm actor={actor} id={r.id} operation="review" review={selfReview}/>}
 {searchParams.job&&actor==="store"&&<p className={styles.muted}>店舗からディーラーへのレビューはディーラーの勤務実績に保存されます。</p>}
 {r.status==="confirmed"&&ended&&!selfCompleted&&!!selfReviewSaved&&<div style={{marginTop:16}}><WorkForm actor={actor} id={r.id} operation="complete"/></div>}
 {r.status==="confirmed"&&!ended&&<p className={styles.muted}>勤務終了時刻を過ぎると完了確認できます。</p>}
 {r.status==="confirmed"&&ended&&!selfReviewSaved&&<p className={styles.muted}>レビューを保存すると「勤務完了」ボタンが表示されます。</p>}
 {r.status==="confirmed"&&selfCompleted&&<p>あなたの完了確認は保存済みです。相手の完了確認がそろうと勤務完了になります。</p>}
 </section>;
 })}
 {!data?.length&&<section className={styles.box}>勤務の記録はまだありません。求人への応募後、ここで条件確定と勤務完了を確認できます。</section>}
 <nav className={styles.pagination}>{page>1&&<Link href={url(page-1)} className={styles.button}>前へ</Link>}<span>{page} / {Math.max(1,Math.ceil((count||0)/6))}</span>{page*6<(count||0)&&<Link href={url(page+1)} className={styles.button}>次へ</Link>}</nav></main>;
 return actor==="store"?content:<><PortalHeader userEmail={user.email}/>{content}<PortalFooter/></>;
}
