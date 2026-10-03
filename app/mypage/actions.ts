"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// マイページのアイコン画像アップロード(2026/10、「会員マイページに
// アイコンを設定できるようにして」との指示)。board/actions.tsの
// 投稿画像アップロードと同じパターン(ファイルをストレージへアップロード
// →公開URLをDBに保存)。保存先はavatar-imagesバケット、パスは
// `${user.id}/...`にしているので、profilesテーブルと違いストレージ側の
// 本人確認(storage.foldername(name)[1] = auth.uid())もこれで成立する。
const AVATAR_BUCKET = "avatar-images";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

function extFromFile(file: File): string {
  const fromName = file.name?.split(".").pop();
  if (fromName && /^[a-zA-Z0-9]{1,8}$/.test(fromName)) {
    return fromName.toLowerCase();
  }
  const fromType = file.type?.split("/").pop();
  return fromType && /^[a-zA-Z0-9]{1,8}$/.test(fromType) ? fromType.toLowerCase() : "jpg";
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/mypage");
  }

  const image = formData.get("avatar");
  if (!(image instanceof File) || image.size === 0) {
    throw new Error("画像を選択してください。");
  }
  if (!image.type.startsWith("image/")) {
    throw new Error("画像ファイルを選択してください。");
  }
  if (image.size > MAX_AVATAR_BYTES) {
    throw new Error("画像のサイズが大きすぎます（5MBまで）。");
  }

  const path = `${user.id}/${randomUUID()}.${extFromFile(image)}`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, image, { contentType: image.type, upsert: false });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  // サミット一覧・詳細のアイコン表示にも反映させる。
  revalidatePath("/mypage");
  revalidatePath("/board");
  revalidatePath("/", "layout");
}

export async function removeAvatar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/mypage");
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, avatar_url: null, updated_at: new Date().toISOString() });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/mypage");
  revalidatePath("/board");
  revalidatePath("/", "layout");
}
