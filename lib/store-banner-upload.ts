import { randomUUID } from "crypto";

// 求人・クーポン・イベントのバナー画像アップロード共通処理(2026/09/30新設)。
// 「求人、クーポン、イベントは画像添付もできるように」との要望を受け、
// 既存の店舗写真(store-photos バケット)と同じ仕組みを使い、
// {storeId}/banners/{jobs|coupons|events}/{uuid}.ext というパスに保存する。
// バケットのRLSポリシーはパスの最初のフォルダ(=storeId)だけを見て
// 所有者を判定しているので、この配下ならどんなサブパスでも許可される。
const PHOTOS_BUCKET = "store-photos";
const MAX_BANNER_BYTES = 8 * 1024 * 1024; // 8MB

function extFromFile(file: File): string {
  const fromName = file.name?.split(".").pop();
  if (fromName && /^[a-zA-Z0-9]{1,8}$/.test(fromName)) {
    return fromName.toLowerCase();
  }
  const fromType = file.type?.split("/").pop();
  return fromType && /^[a-zA-Z0-9]{1,8}$/.test(fromType) ? fromType.toLowerCase() : "jpg";
}

export async function uploadBannerImage(
  supabase: any,
  storeId: string,
  subfolder: "jobs" | "coupons" | "events",
  file: File
): Promise<{ url: string; path: string }> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("画像ファイルを選択してください。");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選択してください。");
  }
  if (file.size > MAX_BANNER_BYTES) {
    throw new Error("画像のサイズが大きすぎます（8MBまで）。");
  }

  const path = `${storeId}/banners/${subfolder}/${randomUUID()}.${extFromFile(file)}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);

  return { url: publicUrl, path };
}

export async function removeBannerImage(supabase: any, path: string | null | undefined) {
  if (!path) return;
  await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
}
