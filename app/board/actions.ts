"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const authorName = String(formData.get("authorName") ?? "").trim() || "匿名";

  if (!title || !body) {
    throw new Error("タイトルと本文を入力してください。");
  }

  const { data: post, error } = await supabase
    .from("board_posts")
    .insert({
      title,
      body,
      author_name: authorName,
      author_user_id: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/board");
  redirect(`/board/${post.id}`);
}

export async function createReply(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const authorName = String(formData.get("authorName") ?? "").trim() || "匿名";

  if (!body) {
    throw new Error("返信内容を入力してください。");
  }

  const { error } = await supabase.from("board_replies").insert({
    post_id: postId,
    body,
    author_name: authorName,
    author_user_id: user?.id ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/board/${postId}`);
}

export async function reportPost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("board_reports").insert({
    post_id: postId,
    reporter_user_id: user?.id ?? null,
    reason: "ユーザーからの通報",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/board/${postId}`);
}

export async function reportReply(replyId: string, postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("board_reports").insert({
    reply_id: replyId,
    reporter_user_id: user?.id ?? null,
    reason: "ユーザーからの通報",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/board/${postId}`);
}
