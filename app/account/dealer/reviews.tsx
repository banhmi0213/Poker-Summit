import Link from "next/link";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {DealerReview} from "@/lib/dealer-reliability";
import {Stars} from "@/app/matching/work/stars";
import styles from "./reliability.module.css";
export async function DealerReviews({db,id,page=1,path}:{db:SupabaseClient;id:string;page?:number;path:string}){
 const current=Math.max(1,Math.min(10001,Math.floor(page)||1));
 const {data,error}=await db.rpc("get_dealer_reviews",{p_dealer_id:id,p_offset:(current-1)*10});
 if(error)throw new Error("レビューを読み込めませんでした。");
 const reviews:DealerReview[]=data?.reviews??[],count=Number(data?.count??0);
 const url=(n:number)=>path+"?reviews="+n;
 return <section className={styles.reviews}><h2>勤務した店舗からの評価・レビュー</h2><p className={styles.note}>双方の勤務完了を確認した実績だけを表示します。</p>{reviews.map(review=><article key={review.id} className={styles.review}><h3>{review.store_name}</h3><Stars rating={review.rating}/><time dateTime={review.work_start}>{new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",dateStyle:"medium"}).format(new Date(review.work_start))} の勤務</time><p>{review.review}</p></article>)}{!reviews.length&&<p className={styles.note}>表示できるレビューはまだありません。</p>}{count>10&&<nav className={styles.pagination} aria-label="レビューのページ">{current>1&&<Link href={url(current-1)}>前へ</Link>}<span>{current} / {Math.ceil(count/10)}</span>{current*10<count&&<Link href={url(current+1)}>次へ</Link>}</nav>}</section>;
}
