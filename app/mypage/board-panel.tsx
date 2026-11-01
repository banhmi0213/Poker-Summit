import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThreadControls } from "@/app/board/community";
import { BoardReadButton, BoardNotificationLink } from "@/app/board/notification-controls";
import s from "@/app/board/community.module.css";
export async function BoardPanel({ userId, notifications, page = 1 }: { userId: string; notifications: boolean; page?: number }) {
  const db = await createClient();
  const current = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const size = 30;
  if (notifications) {
    const { data, error, count } = await db.from("board_notifications").select("id,kind,actor_id,post_id,reply_id,created_at,read_at,board_posts!inner(title,status)", { count: "exact" }).eq("user_id", userId).eq("board_posts.status", "visible").order("created_at", { ascending:false }).order("id").range((current-1)*size,current*size-1);
    if (error) return <p role="alert">サミット通知を読み込めませんでした。</p>;
    const actorIds = Array.from(new Set((data ?? []).map(n=>n.actor_id).filter(Boolean)));
    const {data:profiles} = actorIds.length ? await db.from("profiles").select("user_id,display_name").in("user_id",actorIds) : {data:[]};
    const names = Object.fromEntries((profiles ?? []).map(p=>[p.user_id,p.display_name]));
    return <section className={s.inbox}><h2 style={{fontSize:17}}>サミット通知（{count ?? 0}件）</h2><p className={s.hint}>メンション・返信・フォロー中スレッドの新着です。通知OFFのスレッドから新しい通知は届きません。</p>{!!data?.some(n=>!n.read_at) && <BoardReadButton />}
      {!data?.length && <p className="muted small">通知はまだありません。</p>}
      {data?.map(n => { const post = n.board_posts as unknown as {title:string}; const href = `/board/${n.post_id}${n.reply_id ? `?focus=${n.reply_id}` : ""}`; return <div key={n.id} className={`${s.inboxItem} ${!n.read_at?s.unread:""}`}>
        <span className={s.hint}>{n.read_at ? "既読" : "● 未読"} · {new Date(n.created_at).toLocaleString("ja-JP", {timeZone:"Asia/Tokyo"})}</span>
        <BoardNotificationLink href={href} id={n.id} unread={!n.read_at}>{post.title}</BoardNotificationLink><p>{names[n.actor_id] || "会員"}さん{n.kind==="mention"?"からメンションされました。":n.kind==="reply"?"から返信が届きました。":"が新しいコメントを投稿しました。"}</p>
        {!n.read_at && <BoardReadButton id={n.id} href={href} />}
      </div>; })}<Pagination total={count ?? 0} page={current} tab="boardNotifications" size={size} /></section>;
  }
  const {data,error,count} = await db.from("board_thread_preferences").select("post_id,following,notifications_enabled,board_posts!inner(id,title,status,updated_at,author_user_id)", {count:"exact"}).eq("user_id",userId).eq("following",true).eq("board_posts.status","visible").order("created_at",{ascending:false}).order("post_id").range((current-1)*size,current*size-1);
  if (error) return <p role="alert">フォロー中のスレッドを読み込めませんでした。</p>;
  const {data:followCounts}=await db.rpc("board_follow_counts",{p_post_ids:(data ?? []).map(f=>f.post_id)});
  const followers=Object.fromEntries((followCounts ?? []).map((r:{post_id:string;total:number})=>[r.post_id,Number(r.total)]));
  return <section className={s.inbox}><h2 style={{fontSize:17}}>フォロー中のスレッド（{count ?? 0}件）</h2><p className={s.hint}>通知OFFでも一覧に残ります。フォローを解除しても投稿やコメントは消えません。</p>{!data?.length && <p className="muted small">フォロー中のスレッドはありません。気になるスレッドで「フォローする」を押してください。</p>}
    {data?.map(f => { const p = f.board_posts as unknown as {id:string;title:string;updated_at:string;author_user_id:string};return <div className={s.inboxItem} key={f.post_id}><Link href={`/board/${f.post_id}`}>{p.title}</Link><span className={s.hint}>最終更新：{new Date(p.updated_at).toLocaleString("ja-JP", {timeZone:"Asia/Tokyo"})}</span><ThreadControls postId={f.post_id} preference={f} followerCount={followers[f.post_id] ?? 0} resolved={false} owner={false} compact /></div>; })}
    <Pagination total={count ?? 0} page={current} tab="boardFollows" size={size} />
  </section>;
}
function Pagination({total,page,tab,size}:{total:number;page:number;tab:string;size:number}) {
  const pages = Math.max(1,Math.ceil(total/size));
  return pages>1 ? <nav className={s.nav} aria-label="サミット一覧のページ送り">{page>1 && <Link href={`/mypage?tab=${tab}&boardPage=${page-1}`}>前へ</Link>}<span>{page} / {pages} ページ</span>{page<pages && <Link href={`/mypage?tab=${tab}&boardPage=${page+1}`}>次へ</Link>}</nav> : null;
}
