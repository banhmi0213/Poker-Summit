import { revalidatePath as nextRevalidatePath, revalidateTag } from "next/cache";

// 公開ページのキャッシュ(TOPの新着・店舗一覧・店舗カード・フッター等)をまとめて捨てるタグ(2026/10)。
// 総合管理・店舗管理で何かを保存したら、サイト側に即反映させるために使う。
export const PUBLIC_DATA_TAG = "public-stores";

/** 公開データのキャッシュを捨てる(次の表示で最新を読み直す) */
export function revalidatePublicData() {
  try {
    revalidateTag(PUBLIC_DATA_TAG);
  } catch {
    /* サーバーアクション外など、捨てられない場面では何もしない */
  }
}

/**
 * next/cache の revalidatePath と同じ。加えて、公開ページ(管理画面・マイページ以外)を
 * 指定したときは、TOP・一覧などが内部に持っているデータキャッシュ(unstable_cache)も捨てる。
 * revalidatePath だけでは unstable_cache の中身が最大60秒〜1時間古いまま残るため。
 */
export function revalidatePath(path: string, type?: "layout" | "page") {
  nextRevalidatePath(path, type);
  if (!/^\/(admin|store\/|mypage|account)/.test(path)) revalidatePublicData();
}
