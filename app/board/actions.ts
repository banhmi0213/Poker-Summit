"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const BOARD_IMAGES_BUCKET = "board-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

function extFromFile(file: File): string {
  const fromName = file.name?.split(".").pop();
  if (fromName && /^[a-zA-Z0-9]{1,8}$/.test(fromName)) {
    return fromName.toLowerCase();
  }
  const fromType = file.type?.split("/").pop();
  return fromType && /^[a-zA-Z0-9]{1,8}$/.test(fromType) ? fromType.toLowerCase() : "jpg";
}

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const authorName = String(formData.get("authorName") ?? "").trim() || "匿名";
  const category = String(formData.get("category") ?? "").trim();

  if (!title || !body) {
    throw new Error("タイトルと本文を入力してください。");
  }

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (!image.type.startsWith("image/")) {
      throw new Error("画像ファイルを選択してください。");
    }
    if (image.size > MAX_IMAGE_BYTES) {
      throw new Error("画像のサイズが大きすぎます（8MBまで）。");
    }
  }

  const { data: post, error } = await supabase
    .from("board_posts")
    .insert({
      title,
      body,
      author_name: authorName,
      author_user_id: user?.id ?? null,
      category: category || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (image instanceof File && image.size > 0) {
    const path = `${post.id}/${randomUUID()}.${extFromFile(image)}`;
    const { error: uploadError } = await supabase.storage
      .from(BOARD_IMAGES_BUCKET)
      .upload(path, image, { contentType: image.type, upsert: false });

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from(BOARD_IMAGES_BUCKET).getPublicUrl(path);
      await supabase.from("board_posts").update({ image_url: publicUrl }).eq("id", post.id);
    }
    // アップロードに失敗しても投稿自体は作成済みなので、画像なしでそのまま
    // 進める(投稿全体を失敗させない)。
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

  const { error } = await supabase.from("reports").insert({
    target_type: "post",
    target_id: postId,
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

  const { error } = await supabase.from("reports").insert({
    target_type: "reply",
    target_id: replyId,
    reporter_user_id: user?.id ?? null,
    reason: "ユーザーからの通報",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/board/${postId}`);
}
