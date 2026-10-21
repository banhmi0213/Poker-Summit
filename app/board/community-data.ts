import type { createClient } from "@/lib/supabase/server";
import type { BoardReaction } from "@/lib/board-community";
type DB = Awaited<ReturnType<typeof createClient>>;
export async function getThreadCommunity(db: DB, postId: string, userId: string, replyIds: string[]) {
  const [pref, resolution, counts] = await Promise.all([
    db.from("board_thread_preferences").select("following,notifications_enabled").eq("post_id", postId).eq("user_id", userId).maybeSingle(),
    db.from("board_resolutions").select("reply_id").eq("post_id", postId).maybeSingle(),
    db.rpc("board_reply_counts", {p_post_id:postId}),
  ]);
  if (pref.error || resolution.error || counts.error) throw new Error("サミットの追加機能を読み込めませんでした。時間をおいて再度お試しください。");
  const {data: reactionRows,error: reactionError} = await db.rpc("board_reaction_summary",{p_post_id:postId,p_reply_ids:replyIds});
  if (reactionError) throw new Error("リアクションを読み込めませんでした。");
  const reactions = (reactionRows ?? []) as BoardReaction[];
  const grouped: Record<string,number> = {};
  let totalReplies = 0;
  for (const row of counts.data ?? []) { totalReplies += Number(row.total); if (row.parent_reply_id) grouped[row.parent_reply_id] = Number(row.total); }
  return {preference:pref.data ?? {following:false,notifications_enabled:true},resolved:!!resolution.data,resolutionId:resolution.data?.reply_id ?? null,counts:grouped,totalReplies,reactions};
}
