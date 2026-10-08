import Link from "next/link";
import {reportAccess} from "./access";
import styles from "@/app/matching/chat/chat.module.css";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:{status?:string;page?:string}}){
 const db=await reportAccess(),status=searchParams.status==="resolved"?"resolved":"open",page=Math.max(1,Math.min(10000,parseInt(searchParams.page||"1",10)||1));
 const {data,error,count}=await db.from("dealer_chat_reports").select("id,reason,status,created_at",{count:"exact"}).eq("status",status).order("created_at",{ascending:false}).order("id").range((page-1)*10,page*10-1);
 if(error)throw new Error("通報を読み込めませんでした。");
 return <main className={styles.page}><h1>マッチング通報</h1><p className={styles.muted}>通報されたチャットの内容だけを、対応のために確認できます。</p><div className={styles.links}><Link className={styles.button} href="?status=open">未対応</Link><Link className={styles.button} href="?status=resolved">対応済み</Link></div>{(data||[]).map(r=><section key={r.id} className={styles.card}><p>{new Date(r.created_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</p><p style={{whiteSpace:"pre-wrap"}}>{r.reason}</p><Link className={styles.button} href={"/admin/dealer-chat-reports/"+r.id}>通報・履歴を確認する</Link></section>)}{!data?.length&&<p>該当する通報はありません。</p>}<nav className={styles.pagination}>{page>1&&<Link href={"?status="+status+"&page="+(page-1)}>前へ</Link>}<span>{page} / {Math.max(1,Math.ceil((count||0)/10))}</span>{page*10<(count||0)&&<Link href={"?status="+status+"&page="+(page+1)}>次へ</Link>}</nav></main>;
}
