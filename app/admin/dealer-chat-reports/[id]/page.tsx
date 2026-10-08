import Link from "next/link";
import {notFound} from "next/navigation";
import {reportAccess} from "../access";
import {resolveReport} from "../actions";
import {UUID} from "@/lib/spot-jobs";
import styles from "@/app/matching/chat/chat.module.css";
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:{id:string};searchParams:{page?:string;saved?:string}}){
 if(!UUID.test(params.id))notFound();const db=await reportAccess();const {data:r,error}=await db.from("dealer_chat_reports").select("*").eq("id",params.id).maybeSingle();if(error)throw new Error("通報を読み込めませんでした。");if(!r)notFound();
 const page=Math.max(1,Math.min(10000,parseInt(searchParams.page||"1",10)||1));
 const [messages,terms]=await Promise.all([db.from("dealer_chat_messages").select("id,body,sender_id,created_at",{count:"exact"}).eq("record_id",r.record_id).order("created_at",{ascending:false}).order("id",{ascending:false}).range((page-1)*50,page*50-1),db.from("dealer_chat_terms").select("contract_type,payment_method,payment_date,notes,revision").eq("record_id",r.record_id).maybeSingle()]);
 if(messages.error||terms.error)throw new Error("履歴を読み込めませんでした。");
 return <main className={styles.page}><Link href="/admin/dealer-chat-reports">← 通報一覧</Link><h1>通報内容・チャット履歴</h1>{searchParams.saved&&<p role="status">対応済みにしました。</p>}<section className={styles.card}><p>状態：{r.status==="open"?"未対応":"対応済み"}</p><p style={{whiteSpace:"pre-wrap"}}>{r.reason}</p><p className={styles.muted}>勤務記録：{r.record_id}</p>{r.status==="open"&&<form action={resolveReport}><input type="hidden" name="id" value={r.id}/><button className={styles.primary}>対応済みにする</button></form>}</section>{terms.data&&<section className={styles.card}><h2>合意条件（版 {terms.data.revision}）</h2><p>{terms.data.contract_type==="employment"?"雇用":"業務委託"} ／ {terms.data.payment_method==="bank"?"銀行振込":"現金"} ／ {terms.data.payment_date}</p><p style={{whiteSpace:"pre-wrap"}}>{terms.data.notes}</p></section>}<section className={styles.card}>{[...(messages.data||[])].reverse().map(m=><article key={m.id}><p className={styles.meta}>{m.sender_id===r.reporter_id?"通報者":"相手"} · {new Date(m.created_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</p><p className={styles.bubble}>{m.body}</p></article>)}{!messages.data?.length&&<p>メッセージはありません。</p>}</section><nav className={styles.pagination}>{page>1&&<Link href={"?page="+(page-1)}>新しい履歴</Link>}{page*50<(messages.count||0)&&<Link href={"?page="+(page+1)}>過去の履歴</Link>}</nav></main>;
}
