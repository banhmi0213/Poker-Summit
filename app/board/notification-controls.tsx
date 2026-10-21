"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { markBoardNotificationsRead } from "./community-actions";
export function BoardReadButton({ id, href }: { id?: string; href?: string }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  return <><button className="btn" disabled={pending} onClick={async () => { setError(""); setPending(true); try { await markBoardNotificationsRead(id); if (href) router.push(href); else router.refresh(); } catch { setError("既読にできませんでした。もう一度お試しください。"); } finally { setPending(false); } }}>{pending ? "処理中…" : href ? "投稿を見る・既読にする" : id ? "既読にする" : "すべて既読にする"}</button>{error && <span role="alert">{error}</span>}</>;
}

export function BoardNotificationLink({href,children,className,unread=false,id,ownPostsOnly=false}:{href:string;children:ReactNode;className?:string;unread?:boolean;id?:string;ownPostsOnly?:boolean}) {
 const router=useRouter(); const [pending,setPending]=useState(false); const [error,setError]=useState("");
 return <><Link href={href} className={className} aria-busy={pending} onClick={async e=>{
  if (!unread || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); if(pending)return; setPending(true); setError("");
  try {await markBoardNotificationsRead(id,ownPostsOnly);router.push(href);router.refresh();}
  catch {setError("通知を既読にできませんでした。再度お試しください。");}
  finally {setPending(false);}
 }}>{children}</Link>{error && <span role="alert">{error}</span>}</>;
}
