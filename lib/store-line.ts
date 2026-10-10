import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { pushLineMessage } from "@/lib/line";
import { SITE_URL } from "@/lib/seo";

// 店舗のLINE(店舗管理でLINE連携済みのもの)へ、お金・掲載まわりの大事なお知らせを送る。
// メールと同じタイミングで送るが、LINEは短い文と管理画面へのリンクだけにする。
// 未連携の店舗には何もしない。失敗しても元の処理は止めない(ベストエフォート)。

export const PLAN_PAGE_URL = `${SITE_URL}/store/profile/plan`;

export async function notifyStoreLine(target: { storeId?: string | null; contractId?: string | null }, text: string): Promise<void> {
  try {
    const svc = createServiceRoleClient();
    let storeId = target.storeId ?? null;
    if (!storeId && target.contractId) {
      const { data } = await svc.from("store_contracts").select("store_id").eq("id", target.contractId).maybeSingle();
      storeId = (data?.store_id as string | undefined) ?? null;
    }
    if (!storeId) return;
    const { data: store } = await svc.from("stores").select("line_user_id").eq("id", storeId).maybeSingle();
    const lineUserId = store?.line_user_id as string | null | undefined;
    if (!lineUserId) return;
    await pushLineMessage(lineUserId, `【Poker Summit】\n${text}`);
  } catch {
    // ベストエフォート
  }
}

export function yen(n: number) {
  return `${n.toLocaleString("ja-JP")}円`;
}
