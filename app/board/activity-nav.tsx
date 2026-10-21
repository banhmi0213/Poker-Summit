import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import s from "./community.module.css";
export async function BoardActivityNav({userId}:{userId:string}) {
  const db=await createClient();
  const {count}=await db.from("board_notifications").select("id",{count:"exact",head:true}).eq("user_id",userId).is("read_at",null);
  return <nav className={s.nav} aria-label="サミットの活動"><Link href="/mypage?tab=boardFollows">☆ フォロー中のスレッド</Link><Link href="/mypage?tab=boardNotifications">🔔 サミット通知{count ? `（未読 ${count}件）` : ""}</Link></nav>;
}
