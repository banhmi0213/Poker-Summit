"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { BANNER_BUCKET, BANNER_POSITIONS } from "@/lib/banners";

export type BannerFormState = { error?: string; success?: string; savedAt?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireAdmin(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("管理者ログインが必要です。");
  const { data: admin, error } = await supabase.rpc("is_admin");
  if (error || admin !== true) throw new Error("運営権限がありません。");
}

function revalidateBannerPages() {
  revalidatePath("/admin/banners");
  revalidatePath("/");
}

// image_url が banners バケットの公開URLならそのオブジェクトパスを返す。
// 画像URL入力時代の外部URLなど、バケット外の画像は null(Storageは触らない)。
function storagePathFromUrl(supabase: Supabase, url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = supabase.storage.from(BANNER_BUCKET).getPublicUrl("").data.publicUrl.replace(/\/?$/, "/");
  if (!url.startsWith(prefix)) return null;
  const path = decodeURIComponent(url.slice(prefix.length).split("?")[0]);
  return path && !path.includes("..") ? path : null;
}

async function removeStoredImage(supabase: Supabase, url: string | null | undefined) {
  const path = storagePathFromUrl(supabase, url);
  if (path) await supabase.storage.from(BANNER_BUCKET).remove([path]);
}

// 中身(マジックバイト)で形式を判定してからアップロードする。拡張子や
// file.type だけを信用しない(ブログ画像のアップロードと同じ方針)。
async function uploadImage(supabase: Supabase, file: File): Promise<{ path: string; url: string }> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("画像は3MB以内のファイルを添付してください。");
  const bytes = Buffer.from(await file.arrayBuffer());
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const mime = png ? "image/png" : jpg ? "image/jpeg" : webp ? "image/webp" : "";
  if (!mime) throw new Error("JPEG・PNG・WebP形式の画像を添付してください。");
  const path = `${randomUUID()}.${png ? "png" : jpg ? "jpg" : "webp"}`;
  const { error } = await supabase.storage
    .from(BANNER_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`画像をアップロードできませんでした（${error.message}）。もう一度お試しください。`);
  return { path, url: supabase.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl };
}

// <input type="datetime-local"> の値(日本時間として入力)をISO文字列にする。
function parseJstDateTime(value: FormDataEntryValue | null, label: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) throw new Error(`${label}の形式が正しくありません。`);
  const date = new Date(`${raw.length === 16 ? `${raw}:00` : raw}+09:00`);
  if (Number.isNaN(date.getTime())) throw new Error(`${label}の形式が正しくありません。`);
  return date.toISOString();
}

function parseLinkUrl(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch {
    throw new Error("リンク先URLは https:// または http:// で始まるURLを入力してください。");
  }
}

export async function saveBanner(_state: BannerFormState, formData: FormData): Promise<BannerFormState> {
  const supabase = await createClient();
  let uploadedPath: string | null = null;
  try {
    await requireAdmin(supabase);

    const id = String(formData.get("id") ?? "").trim();
    if (id && !UUID.test(id)) throw new Error("バナーが見つかりません。");

    const title = String(formData.get("title") ?? "").trim();
    if (!title) throw new Error("バナー名を入力してください。");
    if (title.length > 200) throw new Error("バナー名は200文字以内で入力してください。");

    const position = String(formData.get("position") ?? "top").trim();
    if (!BANNER_POSITIONS.some((p) => p.value === position)) throw new Error("表示位置を選択してください。");

    const linkUrl = parseLinkUrl(formData.get("linkUrl"));
    const scope = String(formData.get("scope") ?? "").trim() || null;
    const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim() || "0";
    const sortOrder = Number(sortOrderRaw);
    if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 1_000_000) {
      throw new Error("表示順は整数で入力してください。");
    }
    const startsAt = parseJstDateTime(formData.get("startsAt"), "掲載開始日時");
    const endsAt = parseJstDateTime(formData.get("endsAt"), "掲載終了日時");
    if (startsAt && endsAt && startsAt >= endsAt) throw new Error("掲載終了日時は掲載開始日時より後にしてください。");
    const active = formData.get("active") === "on";

    let previousImageUrl: string | null = null;
    if (id) {
      const { data: existing, error } = await supabase.from("banners").select("image_url").eq("id", id).maybeSingle();
      if (error || !existing) throw new Error("バナーが見つかりません。再読み込みしてください。");
      previousImageUrl = existing.image_url;
    }

    const file = formData.get("image");
    let imageUrl = previousImageUrl;
    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadImage(supabase, file);
      uploadedPath = uploaded.path;
      imageUrl = uploaded.url;
    }

    const values = {
      title,
      image_url: imageUrl,
      link_url: linkUrl,
      position,
      scope,
      sort_order: sortOrder,
      starts_at: startsAt,
      ends_at: endsAt,
      active,
    };

    const query = id
      ? supabase.from("banners").update(values).eq("id", id)
      : supabase.from("banners").insert(values);
    const { data: saved, error } = await query.select("id").single();
    if (error || !saved) throw new Error(`バナーを保存できませんでした（${error?.message ?? "不明なエラー"}）。`);
    uploadedPath = null;

    // 画像を差し替えたときだけ、旧画像(banners バケット内のもの)を消す。
    if (id && imageUrl !== previousImageUrl) await removeStoredImage(supabase, previousImageUrl);

    await logAdminAction(supabase, id ? "banner_update" : "banner_create", "banner", saved.id, {
      title,
      position,
      imageReplaced: Boolean(id && imageUrl !== previousImageUrl),
    });
    revalidateBannerPages();
    return { success: id ? "バナーを更新しました。" : "バナーを追加しました。", savedAt: Date.now() };
  } catch (e) {
    // DB登録に失敗したら、今回アップロードした画像は残さない。
    if (uploadedPath) await supabase.storage.from(BANNER_BUCKET).remove([uploadedPath]);
    return { error: e instanceof Error ? e.message : "保存できませんでした。" };
  }
}

export async function toggleBannerActive(bannerId: string, active: boolean) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase.from("banners").update({ active }).eq("id", bannerId);
  if (error) throw new Error(error.message);

  await logAdminAction(supabase, active ? "banner_activate" : "banner_deactivate", "banner", bannerId);
  revalidateBannerPages();
}

export async function updateBannerSortOrder(bannerId: string, formData: FormData) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const sortOrder = Number(String(formData.get("sortOrder") ?? "").trim());
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 1_000_000) {
    throw new Error("表示順は整数で入力してください。");
  }
  const { error } = await supabase.from("banners").update({ sort_order: sortOrder }).eq("id", bannerId);
  if (error) throw new Error(error.message);

  await logAdminAction(supabase, "banner_reorder", "banner", bannerId, { sortOrder });
  revalidateBannerPages();
}

// 上下ボタン。同じ表示位置のバナーを今の並び(表示順→登録順)で並べ、
// 対象を1つ動かしてから表示順を10刻みで振り直す(表示順が同じ値の行同士
// でも確実に入れ替わるようにするため)。
export async function moveBanner(bannerId: string, direction: "up" | "down") {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { data: target } = await supabase.from("banners").select("position").eq("id", bannerId).maybeSingle();
  if (!target) throw new Error("バナーが見つかりません。");

  const { data: siblings, error } = await supabase
    .from("banners")
    .select("id, sort_order")
    .eq("position", target.position)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !siblings) throw new Error(error?.message ?? "並び替えできませんでした。");

  const from = siblings.findIndex((b) => b.id === bannerId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= siblings.length) return;

  const ordered = [...siblings];
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  const updates = ordered
    .map((b, i) => ({ id: b.id, sort_order: (i + 1) * 10, changed: b.sort_order !== (i + 1) * 10 }))
    .filter((b) => b.changed);
  for (const u of updates) {
    const { error: updateError } = await supabase.from("banners").update({ sort_order: u.sort_order }).eq("id", u.id);
    if (updateError) throw new Error(updateError.message);
  }

  await logAdminAction(supabase, "banner_reorder", "banner", bannerId, { direction });
  revalidateBannerPages();
}

export async function deleteBanner(bannerId: string) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { data: banner } = await supabase.from("banners").select("title, image_url").eq("id", bannerId).maybeSingle();
  if (!banner) throw new Error("バナーが見つかりません。");

  const { error } = await supabase.from("banners").delete().eq("id", bannerId);
  if (error) throw new Error(error.message);

  await removeStoredImage(supabase, banner.image_url);
  await logAdminAction(supabase, "banner_delete", "banner", bannerId, { title: banner.title });
  revalidateBannerPages();
}
