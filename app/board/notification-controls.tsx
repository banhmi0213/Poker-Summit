"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { markBoardNotificationsRead } from "./community-actions";
export function BoardReadButton({ id, href }: { id?: string; href?: string }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  return <><button className="btn" disabled={pending} onClick={async () => { setError(""); setPending(true); try { await markBoardNotificationsRead(id); if (href) router.push(href); else router.refresh(); } catch { setError("既読にできませんでした。もう一度お試しください。"); } finally { setPending(false); } }}>{pending ? "処理中…" : href ? "投稿を見る・既読にする" : id ? "既読にする" : "すべて既読にする"}</button>{error && <span role="alert">{error}</span>}</>;
}
