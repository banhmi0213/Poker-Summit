import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import s from "./community.module.css";
export async function BoardActivityNav({userId}:{userId:string}) {
  const db=await createClient();
  const [{count:total},{count:follows}]=await Promise.all([db.from("board_notifications").select("id",{count:"exact",head:true}).eq("user_id",userId),db.from("board_thread_preferences").select("post_id,board_posts!inner(status)",{count:"exact",head:true}).eq("user_id",userId).eq("following",true).eq("board_posts.status","visible")]);
  const {count}=await db.from("board_notifications").select("id",{count:"exact",head:true}).eq("user_id",userId).is("read_at",null);
  return <nav className={s.nav} aria-label="サミットの活動"><Link href="/mypage?tab=boardFollows">☆ フォロー中のスレッド（{follows ?? 0}件）</Link><Link href="/mypage?tab=boardNotifications">🔔 サミット通知（{total ?? 0}件・未読 {count ?? 0}件）</Link></nav>;
}
