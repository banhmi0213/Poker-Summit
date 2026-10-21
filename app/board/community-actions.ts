"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "@/lib/revalidate";
import { BOARD_REACTIONS, UUID_PATTERN } from "@/lib/board-community";

async function member() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("ログインしてください。");
  const { data: suspended, error } = await db.rpc("is_suspended");
  if (error || suspended) throw new Error("現在この操作はできません。");
  return { db, user };
}
function id(value: string) { if (!UUID_PATTERN.test(value)) throw new Error("対象が不正です。"); return value; }
function invalidate(postId: string) {
  revalidatePath(`/board/${postId}`);
  revalidatePath("/board");
  revalidatePath("/mypage");
}
export async function setThreadPreference(postId: string, key: "following" | "notifications_enabled", value: boolean) {
  const { db, user } = await member(); id(postId);
  if (!["following", "notifications_enabled"].includes(key) || typeof value !== "boolean") throw new Error("設定が不正です。");
  // Read-modify-upsert would overwrite another device's changes. Only update
  // the requested column, and use an insert-ignore for initial defaults.
  const { error: insertError } = await db.from("board_thread_preferences").upsert({ post_id: postId, user_id: user.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
  if (insertError) throw new Error("設定を保存できませんでした。");
  const { error } = await db.from("board_thread_preferences").update({ [key]: value }).eq("post_id", postId).eq("user_id", user.id);
  if (error) throw new Error("設定を保存できませんでした。");
  invalidate(postId);
}
export async function setBoardReaction(postId: string, replyId: string | null, emoji: string, enabled: boolean) {
  const { db, user } = await member(); id(postId); if (replyId) id(replyId);
  if (!BOARD_REACTIONS.some(r => r.key === emoji) || typeof enabled !== "boolean") throw new Error("リアクションが不正です。");
  let error;
  if (enabled) {
    ({ error } = await db.from("board_reactions").insert({ post_id: postId, reply_id: replyId, user_id: user.id, emoji }));
    if (error?.code === "23505") error = null; // repeated clicks are idempotent
  } else {
    let query = db.from("board_reactions").delete().eq("post_id", postId).eq("user_id", user.id).eq("emoji", emoji);
    query = replyId ? query.eq("reply_id", replyId) : query.is("reply_id", null);
    ({ error } = await query);
  }
  if (error) throw new Error("リアクションを保存できませんでした。");
  invalidate(postId);
}
export async function setThreadResolution(postId: string, replyId: string | null, enabled: boolean) {
  const { db, user } = await member(); id(postId); if (replyId) id(replyId);
  if (typeof enabled !== "boolean") throw new Error("設定が不正です。");
  const { data: post } = await db.from("board_posts").select("author_user_id").eq("id", postId).eq("status", "visible").maybeSingle();
  if (post?.author_user_id !== user.id) throw new Error("回答済みを変更できるのはスレ主だけです。");
  // Owner-only RLS also enforces this on direct Data API requests.
  if (enabled) {
    const { data: existing } = await db.from("board_resolutions").select("post_id").eq("post_id", postId).maybeSingle();
    if (existing) throw new Error("別の回答を選ぶ場合は、先に回答済みを解除してください。");
    const { error } = await db.from("board_resolutions").insert({ post_id: postId, reply_id: replyId });
    if (error) throw new Error("回答済みを保存できませんでした。");
  } else {
    const { error } = await db.from("board_resolutions").delete().eq("post_id", postId);
    if (error) throw new Error("回答済みを解除できませんでした。");
  }
  invalidate(postId);
}
export async function searchMentionMembers(search: string) {
  const { db } = await member();
  const q = search.trim().slice(0, 30);
  if (q.length < 1) return [];
  const safe = q.replace(/[%_\\]/g, "");
  if (!safe) return [];
  const { data, error } = await db.from("profiles").select("user_id, display_name").ilike("display_name", `%${safe}%`).order("display_name").order("user_id").limit(8);
  if (error) throw new Error("候補を取得できませんでした。");
  return (data ?? []).filter(m => m.display_name && !/[\]\r\n]/.test(m.display_name));
}
export async function loadBoardChildren(postId: string, parentId: string, page: number) {
  const { db } = await member(); id(postId); id(parentId);
  const p = Number.isSafeInteger(page) && page > 0 ? page : 0;
  const { data: parent } = await db.from("board_replies").select("id").eq("id", parentId).eq("post_id", postId).eq("status", "visible").is("parent_reply_id", null).maybeSingle();
  if (!parent) throw new Error("返信先が見つかりません。");
  const { data, error, count } = await db.from("board_replies").select("id,post_id,body,author_name,author_user_id,created_at,image_url,parent_reply_id", { count: "exact" }).eq("post_id", postId).eq("parent_reply_id", parentId).eq("status", "visible").order("created_at").order("id").range(p * 20, p * 20 + 19);
  if (error) throw new Error("返信を読み込めませんでした。");
  const ids = (data ?? []).map(r=>r.id);
  const [{data:reactions,error:reactionError},{data:profiles}] = await Promise.all([
    db.rpc("board_reaction_summary",{p_post_id:postId,p_reply_ids:ids}),
    db.from("profiles").select("user_id,avatar_url,role").in("user_id",(data ?? []).map(r=>r.author_user_id).filter(Boolean)),
  ]);
  if (reactionError) throw new Error("リアクションを読み込めませんでした。");
  const {data:official}=await db.rpc("official_board_user_ids",{p_ids:(profiles ?? []).map(p=>p.user_id)});
  return { replies: data ?? [], total: count ?? 0, reactions:reactions ?? [], authors:Object.fromEntries((profiles ?? []).map(p=>[p.user_id,{avatar:p.avatar_url,role:p.role,official:(official ?? []).includes(p.user_id)}])) };
}
export async function markBoardNotificationsRead(notificationId?: string, ownPostsOnly = false) {
  const { db, user } = await member();
  let query = db.from("board_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (notificationId) query = query.eq("id", id(notificationId));
  if (ownPostsOnly) {
    const {data:posts,error:postError}=await db.from("board_posts").select("id").eq("author_user_id",user.id);
    if (postError) throw new Error("投稿を確認できませんでした。");
    if (!posts?.length) return;
    query=query.in("post_id",posts.map(p=>p.id));
  }
  const { error } = await query;
  if (error) throw new Error("既読にできませんでした。");
  revalidatePath("/mypage");
  revalidatePath("/board");
}
