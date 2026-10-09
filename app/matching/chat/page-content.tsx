import {NotificationBadge} from "./notification-badge";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createStoreClient} from "@/lib/supabase/store-server";
import {dealerAccess} from "@/lib/spot-jobs-server";
import {requireMatchingConsent} from "@/lib/matching-consent-server";
import {UUID} from "@/lib/spot-jobs";
import {PortalHeader} from "@/app/portal-header";
import {PortalFooter} from "@/app/portal-footer";
import {ChatForm,ConsentForm,TermsForm,MessageHistory,MarkNotificationsRead,type Terms} from "./forms";
import styles from "./chat.module.css";
import {LiveChat} from "./live-chat";
import {ChatContactForm} from "./contact-form";
type Actor="store"|"dealer";
const base=(actor:Actor)=>actor==="store"?"/store/profile/dealer-chat":"/account/dealer/chat";
const work=(actor:Actor)=>actor==="store"?"/store/profile/spot-jobs/work":"/account/dealer/work";
const time=(value:string)=>new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
async function access(actor:Actor,path:string){
 const dealer=actor==="dealer"?await dealerAccess(path):null;
 if(dealer&&!dealer.allowed)redirect("/account/dealer/edit");
 const db=dealer?dealer.db:await createStoreClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/store/login?next="+encodeURIComponent(path));
 await requireMatchingConsent(db,user.id,actor,path);
 const stores=actor==="store"?await db.from("stores").select("id").eq("owner_user_id",user.id):null;
 if(stores?.error)throw new Error("店舗を確認できませんでした。");
 if(actor==="store"&&!stores?.data?.length)notFound();
 return {db,user,stores:stores?.data?.map(s=>s.id)||[]};
}
function wrap(actor:Actor,email:string|undefined,content:React.ReactNode){return actor==="store"?<>{content}</>:<><PortalHeader userEmail={email}/>{content}<PortalFooter/></>;}
export async function ChatList({actor,page="1"}:{actor:Actor;page?:string}){
 const path=base(actor),{db,user,stores}=await access(actor,path);const number=Math.max(1,Math.min(10000,parseInt(page,10)||1));
 let query=db.from("dealer_matching_records").select("id,work_start,status,job_snapshot",{count:"exact"});
 query=actor==="store"?query.in("store_id",stores):query.eq("dealer_user_id",user.id);
 const {data,error,count}=await query.order("created_at",{ascending:false}).order("id").range((number-1)*6,number*6-1);
 if(error)throw new Error("チャット一覧を読み込めませんでした。");
 const notices=await db.rpc("matching_unread_rooms",{p_actor:actor,p_page:number});if(notices.error)throw new Error("通知を読み込めませんでした。");
 const unreadRooms=notices.data as {record_id:string;unread:number;latest:string}[]||[];
 // The unread-room page is independent of the chronological chat-list page.
 // Count each visible room directly so unread badges also work on later pages.
 const unreadCounts:Record<string,number>={};
 await Promise.all((data||[]).map(async r=>{
  const result=await db.from("matching_notifications").select("id",{count:"exact",head:true}).eq("recipient_id",user.id).eq("recipient_actor",actor).eq("record_id",r.id).is("read_at",null);
  if(result.error)throw new Error("未読件数を読み込めませんでした。");
  unreadCounts[r.id]=result.count||0;
 }));
 const names=new Map<string,{id:string;work_start:string;job_snapshot:{dealer_name?:string;store_name?:string}}>((data||[]).map(r=>[r.id,r]));
 const missing=unreadRooms.filter(n=>!names.has(n.record_id)).map(n=>n.record_id);
 if(missing.length){
  let details=db.from("dealer_matching_records").select("id,work_start,job_snapshot").in("id",missing);
  details=actor==="store"?details.in("store_id",stores):details.eq("dealer_user_id",user.id);
  const result=await details;if(result.error)throw new Error("未読チャットを読み込めませんでした。");
  for(const r of result.data||[])names.set(r.id,r);
 }
 const roomName=(r:{job_snapshot?:{dealer_name?:string;store_name?:string}}|undefined)=>actor==="store"?r?.job_snapshot?.dealer_name||"ディーラー":r?.job_snapshot?.store_name||"店舗";

 return wrap(actor,user.email,<main className={styles.page}><Link href={actor==="store"?"/store/profile/spot-jobs":"/account/dealer"}>← {actor==="store"?"スポット求人管理":"ディーラープロフィール"}に戻る</Link><h1>応募・オファーのチャット<NotificationBadge actor={actor}/></h1><p className={styles.muted}>勤務日ごとに条件を確認します。双方が合意すると連絡先が開示されます。</p><div className={styles.links}><Link className={styles.button} href={work(actor)}>✓ 勤務完了・レビュー</Link></div>{unreadRooms.length>0&&<section className={styles.card}><h2>未読の応募・チャット</h2><p className={styles.muted}>未読がある相手です。ボタンから該当のチャットを直接開けます。</p>{unreadRooms.map(n=>{const r=names.get(n.record_id);return <div key={n.record_id} className={styles.unreadRow}><div><strong>{roomName(r)}</strong><span className={styles.unreadBadge}>未読 {n.unread}件</span>{r&&<p className={styles.workDate}>勤務：{time(r.work_start)}（日本時間）</p>}<p className={styles.muted}>最新通知：{time(n.latest)}</p></div><Link className={styles.button+" "+styles.unreadButton} href={path+"/"+n.record_id} aria-label={roomName(r)+"の未読チャットを開く"}>未読チャットを開く →</Link></div>;})}</section>}{(data||[]).map(r=><section key={r.id} className={styles.card+" "+styles.list+(unreadCounts[r.id]>0?" "+styles.unreadCard:"")}><div>{unreadCounts[r.id]>0&&<span className={styles.unreadBadge}>未読 {unreadCounts[r.id]}件</span>}<span className={styles.tag}>{r.status==="pending"?"条件確認中":r.status==="confirmed"?"勤務確定":r.status==="completed"?"勤務完了":"確認対応中"}</span><h2 style={{marginTop:14}}>{actor==="store"?r.job_snapshot?.dealer_name||"ディーラー":r.job_snapshot?.store_name||"店舗"}</h2><p>{time(r.work_start)}（日本時間）</p><p className={styles.muted}>{r.job_snapshot?.source==="store_offer"?"店舗からのオファー":"ディーラーからの応募"}</p></div><Link className={styles.button+(unreadCounts[r.id]>0?" "+styles.unreadButton:"")} href={path+"/"+r.id}>{unreadCounts[r.id]>0?"未読チャットを開く →":"チャット・条件確認"}</Link></section>)}{!data?.length&&<section className={styles.card}>応募・オファーはまだありません。{actor==="store"?<p><Link href="/store/profile/dealers">フリーディーラーを探す</Link></p>:<p><Link href="/spot-jobs">スポット求人を探す</Link></p>}</section>}<nav className={styles.pagination}>{number>1&&<Link href={path+"?page="+(number-1)}>前へ</Link>}<span>{number} / {Math.max(1,Math.ceil((count||0)/6))}</span>{number*6<(count||0)&&<Link href={path+"?page="+(number+1)}>次へ</Link>}</nav></main>);
}
export async function ChatRoom({actor,id,page="1"}:{actor:Actor;id:string;page?:string}){
 if(!UUID.test(id))notFound();const path=base(actor)+"/"+id,{db,user,stores}=await access(actor,path);
 let query=db.from("dealer_matching_records").select("*").eq("id",id);
 query=actor==="store"?query.in("store_id",stores):query.eq("dealer_user_id",user.id);
 const {data:r,error}=await query.maybeSingle();if(error)throw new Error("勤務記録を読み込めませんでした。");if(!r)notFound();
 const consent=await db.from("dealer_chat_consents").select("accepted_at").eq("record_id",id).eq("user_id",user.id).eq("version","2026-10-08-chat-v1").maybeSingle();
 if(consent.error)throw new Error("同意を確認できませんでした。");
 const j=r.job_snapshot||{},name=actor==="store"?j.dealer_name||"ディーラー":j.store_name||"店舗";
 if(!consent.data)return wrap(actor,user.email,<main className={styles.page}><Link href={base(actor)}>← チャット一覧に戻る</Link><h1>チャットを始める前に</h1><section className={styles.card}><h2>{name}</h2><p>{time(r.work_start)}（日本時間）</p><ConsentForm actor={actor} record={id}/></section></main>);
 const number=Math.max(1,Math.min(10000,parseInt(page,10)||1));
 const [messages,termResult,blocks]=await Promise.all([db.from("dealer_chat_messages").select("id,sender_id,body,created_at",{count:"exact"}).eq("record_id",id).order("created_at",{ascending:false}).order("id",{ascending:false}).range((number-1)*50,number*50-1),db.from("dealer_chat_terms").select("revision,contract_type,payment_method,payment_date,notes").eq("record_id",id).maybeSingle(),db.from("dealer_chat_blocks").select("user_id").eq("record_id",id)]);
 if(messages.error||termResult.error||blocks.error)throw new Error("チャットを読み込めませんでした。");
 const terms=termResult.data as Terms|null,blocked=!!blocks.data?.length,selfBlocked=blocks.data?.some(b=>b.user_id===user.id),confirmed=["confirmed","completed"].includes(r.status)&&!!r.store_confirmed_at&&!!r.dealer_confirmed_at,selfConfirmed=actor==="store"?r.store_confirmed_at:r.dealer_confirmed_at,canConfirm=r.status==="pending"&&Date.parse(r.work_start)>Date.now()&&!blocked;
 let ownContact:{phone:string;contact_type:string;contact_value:string;disclosure_consented_at:string|null;disclosure_version:string|null}|null=null;
 if(actor==="dealer"){const result=await db.from("dealer_private_contacts").select("phone,contact_type,contact_value,disclosure_consented_at,disclosure_version").eq("user_id",user.id).maybeSingle();if(result.error)throw new Error("連絡先を確認できませんでした。");ownContact=result.data;}
 const contactReady=actor==="store"||!!(ownContact?.phone&&ownContact.contact_value&&ownContact.disclosure_consented_at&&ownContact.disclosure_version==="2026-10-07-contact-v1");
 let contact:{phone:string;contact_type:string;contact_value:string}|null=null,storePhone:string|null=null;
 if(confirmed&&!blocked){if(actor==="store"){const result=await db.rpc("get_matching_dealer_contacts",{p_record_id:id});if(result.error)throw new Error("連絡先を確認できませんでした。");contact=result.data?.[0]||null;}else{const result=await db.from("stores").select("tel").eq("id",r.store_id).maybeSingle();if(result.error)throw new Error("店舗を確認できませんでした。");storePhone=result.data?.tel||null;}}
 return wrap(actor,user.email,<main className={styles.page}>{number===1&&<><MarkNotificationsRead actor={actor} record={id} events={[id,...(messages.data||[]).map(m=>m.id)]}/></>}<Link href={base(actor)}>← チャット一覧に戻る</Link><h1>勤務の相談・チャット</h1><div className={styles.grid}><section className={styles.card}><div className={styles.head}><div><h2>{name}</h2><span className={styles.muted}>{time(r.work_start)}（日本時間）</span></div><span className={styles.tag}>{confirmed?"双方の合意済み":r.status==="pending"?"条件確認中":"確認対応中"}</span></div><p className={styles.notice}>合意前の連絡先交換・外部誘導は禁止です。勤務に必要な条件を、このチャットで確認してください。</p><MessageHistory latest={number===1} lastId={messages.data?.[0]?.id||""}>{[...(messages.data||[])].reverse().map(m=><article key={m.id} className={styles.message+(m.sender_id===user.id?" "+styles.mine:"")}><p className={styles.meta}>{m.sender_id===user.id?"あなた":name} · {time(m.created_at)}</p><div className={styles.bubble}>{m.body}</div></article>)}{!messages.data?.length&&<p className={styles.muted}>メッセージはまだありません。勤務条件の確認から始めましょう。</p>}</MessageHistory><nav className={styles.pagination}>{number>1&&<Link href={path+"?page="+(number-1)}>新しい履歴</Link>}{number*50<(messages.count||0)&&<Link href={path+"?page="+(number+1)}>過去の履歴</Link>}</nav>{blocked?<p className={styles.error}>このチャットはブロック中です。送信・条件変更・合意はできません。勤務の取消しにはなりません。</p>:<ChatForm actor={actor} record={id} operation="send" button="メッセージを送信" reset><label>メッセージ<textarea name="body" required maxLength={2000} rows={3} placeholder="勤務について相談する"/></label>{number===1?<LiveChat actor={actor} record={id}/>:<small className={styles.muted}>過去の履歴を表示中です。最新のチャットに戻ると自動受信できます。</small>}</ChatForm>}<details><summary>問題を通報する</summary><ChatForm actor={actor} record={id} operation="report" button="運営に通報する"><label>通報理由<textarea name="reason" required maxLength={2000} rows={3}/></label><p className={styles.muted}>対応のため、運営がこのチャットの履歴を確認します。</p></ChatForm></details><details><summary>{selfBlocked?"ブロックを解除する":"このチャットをブロックする"}</summary><ChatForm actor={actor} record={id} operation={selfBlocked?"unblock":"block"} button={selfBlocked?"自分のブロックを解除":"このチャットをブロック"}>{!selfBlocked&&<label className={styles.check}><input name="agreed" type="checkbox" required/>送信を止めます。勤務はキャンセルされません。</label>}</ChatForm></details></section><aside><section className={styles.card+" "+styles.side}><h2>勤務条件</h2><dl className={styles.facts}><div><dt>勤務日時（日本時間）</dt><dd>{time(r.work_start)} 〜 {time(r.work_end)}</dd></div><div><dt>時給</dt><dd>{j.hourly_wage!=null?"¥"+Number(j.hourly_wage).toLocaleString():"記録なし"}</dd></div><div><dt>交通費</dt><dd>{j.transport_type==="full"?"全額支給":j.transport_type==="limited"?"上限 ¥"+Number(j.transport_limit||0).toLocaleString():j.transport_type==="none"?"支給なし":"記録なし"}</dd></div><div><dt>ゲーム・業務</dt><dd>{j.games?.join("・")}<br/>{j.duties||"記録なし"}</dd></div><div><dt>応募条件・服装</dt><dd>{j.requirements||"記載なし"}<br/>{j.dress||"記載なし"}</dd></div>{terms&&<><div><dt>契約形態</dt><dd>{terms.contract_type==="employment"?"雇用（アルバイト等）":"業務委託"}</dd></div><div><dt>支払方法・支払日</dt><dd>{terms.payment_method==="bank"?"銀行振込":"現金"} ／ {terms.payment_date}</dd></div>{terms.notes&&<div><dt>その他の合意事項</dt><dd>{terms.notes}</dd></div>}</>}</dl><p className={styles.muted}>店舗：{r.store_confirmed_at?"合意済み":"未確認"} ／ ディーラー：{r.dealer_confirmed_at?"合意済み":"未確認"}{terms?" · 条件版 "+terms.revision:""}</p>{canConfirm&&actor==="store"&&<details open={!terms}><summary>{terms?"条件を変更する":"契約・支払条件を設定する"}</summary><TermsForm key={terms?.revision||0} actor={actor} record={id} terms={terms}/></details>}{canConfirm&&terms&&!selfConfirmed&&<ChatForm actor={actor} record={id} operation="confirm" button="勤務条件に合意する"><input name="revision" type="hidden" value={terms.revision}/><label className={styles.check}><input name="agreed" type="checkbox" required/>上記の勤務条件・報酬・支払方法を確認し、合意します。</label></ChatForm>}{canConfirm&&!terms&&<p className={styles.notice}>店舗が契約形態・支払方法・支払日を設定すると、双方が合意できます。</p>}{canConfirm&&selfConfirmed&&<p className={styles.notice}>あなたの合意は保存済みです。相手の確認をお待ちください。</p>}{r.status==="pending"&&Date.parse(r.work_start)<=Date.now()&&<p className={styles.notice}>勤務開始時刻を過ぎたため、新たな合意はできません。問題がある場合は運営にご相談ください。</p>}</section><section className={styles.card}><h2>契約成立後の連絡先</h2>{actor==="dealer"&&!contactReady&&<><p className={styles.notice}>連絡先の登録・開示同意がまだ完了していません。下の入力欄から登録してください。</p><ChatContactForm record={id} contact={ownContact}/></>}{actor==="dealer"&&contactReady&&<p className={styles.notice}>連絡先の登録・開示同意済み。双方の合意後、相手店舗に表示されます。</p>}{confirmed&&!blocked?(actor==="store"?(contact?<dl className={styles.facts}><div><dt>電話番号</dt><dd>{contact.phone}</dd></div><div><dt>{contact.contact_type==="line"?"LINE":"メールアドレス"}</dt><dd>{contact.contact_value}</dd></div></dl>:<p className={styles.muted}>勤務は成立していますが、ディーラーの連絡先の開示同意が未完了です。ディーラー側のチャットに表示される「連絡先を登録・開示に同意する」から登録してもらってください。</p>):<p>店舗電話：{storePhone||"記載なし"}</p>):<p className={styles.muted}>双方が勤務条件に合意すると開示されます。ブロック中は表示しません。</p>}<p className={styles.muted}>開示後の連絡先は、この勤務の連絡にのみ使用してください。</p></section><Link className={styles.button} href={work(actor)+"?record="+id}>✓ 勤務完了・レビューはこちら</Link></aside></div></main>);
}
