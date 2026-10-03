"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { BLOG_CATEGORIES } from "@/lib/blog";

export async function saveBlogEntry(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "管理者ログインが必要です。" };
  const { data: admin, error: authError } = await supabase.rpc("is_admin");
  if (authError || admin !== true) return { error: "運営権限がありません。" };
  const id = String(formData.get("id") || "");
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { error: "記事が見つかりません。" };
  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const category = String(formData.get("category") || "");
  if (!title || title.length > 160 || summary.length > 600) return { error: "タイトルは160文字以内、説明は600文字以内で入力してください。" };
  if (!BLOG_CATEGORIES.some(c => c === category)) return { error: "カテゴリを選択してください。" };
  let articleUrl: string;
  try {
    const url = new URL(String(formData.get("articleUrl") || "").trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.href.length > 2048) throw new Error();
    articleUrl = url.href;
  } catch { return { error: "記事URLは https:// または http:// で入力してください。" }; }
  let previous: { image_url: string; image_path: string } | null = null;
  if (id) {
    const { data, error } = await supabase.from("blog_entries").select("image_url,image_path").eq("id", id).single();
    if (error || !data) return { error: "記事が見つかりません。再読み込みしてください。" };
    previous = data;
  }
  let imageUrl = previous?.image_url || "";
  let imagePath = previous?.image_path || "";
  let uploadedPath: string | null = null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (file.size > 3 * 1024 * 1024) return { error: "画像は3MB以内で添付してください。" };
    const bytes = Buffer.from(await file.arrayBuffer());
    const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP";
    const mime = png ? "image/png" : jpg ? "image/jpeg" : webp ? "image/webp" : "";
    if (!mime || mime !== file.type) return { error: "JPEG・PNG・WebP形式の画像を添付してください。" };
    uploadedPath = `${randomUUID()}.${png ? "png" : jpg ? "jpg" : "webp"}`;
    const { error } = await supabase.storage.from("blog-images").upload(uploadedPath, bytes, { contentType: mime, upsert: false });
    if (error) return { error: "画像を保存できませんでした。もう一度お試しください。" };
    imagePath = uploadedPath;
    imageUrl = supabase.storage.from("blog-images").getPublicUrl(imagePath).data.publicUrl;
  }
  if (!imageUrl) return { error: "記事画像を添付してください。" };
  const values = { title, summary, category, article_url: articleUrl, image_url: imageUrl, image_path: imagePath,
    active: formData.get("active") === "on", featured: formData.get("featured") === "on", updated_at: new Date().toISOString() };
  const query = id ? supabase.from("blog_entries").update(values).eq("id", id) : supabase.from("blog_entries").insert(values);
  const { data: saved, error } = await query.select("id").single();
  if (error || !saved) {
    if (uploadedPath) await supabase.storage.from("blog-images").remove([uploadedPath]);
    return { error: "記事を保存できませんでした。もう一度お試しください。" };
  }
  // Remove only the previous path obtained from the database, never a submitted path.
  if (uploadedPath && previous?.image_path) await supabase.storage.from("blog-images").remove([previous.image_path]);
  await logAdminAction(supabase, id ? "blog_update" : "blog_create", "blog", saved.id, { title, active: values.active });
  revalidatePath("/admin/blog"); revalidatePath("/blog"); revalidatePath("/");
  return { success: id ? "変更を保存しました。" : "記事を追加しました。" };
}
