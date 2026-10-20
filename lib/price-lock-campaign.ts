import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";

// 年内お申込み特典(料金据え置き)の表示用設定(2026/10)。
// enabled: 運営が「表示する」をONにしているか(OFFの間は申込画面・規約・特商法のどこにも出さない)
// accepting: 今申し込めば対象になるか(ONかつ期限内)
export type PriceLockCampaign = { enabled: boolean; accepting: boolean; deadlineLabel: string; deadlineIso: string | null };

export const PRICE_LOCK_CACHE_TAG = "price-lock-campaign";

export const getPriceLockCampaign = unstable_cache(
  async (): Promise<PriceLockCampaign> => {
    const { data } = await createAnonClient()
      .from("site_settings")
      .select("price_lock_campaign_enabled, price_lock_deadline")
      .eq("id", true)
      .maybeSingle();
    const enabled = !!data?.price_lock_campaign_enabled;
    const deadline = data?.price_lock_deadline ? new Date(data.price_lock_deadline as string) : null;
    const deadlineLabel = deadline
      ? deadline.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" })
      : "";
    return { enabled, accepting: enabled && !!deadline && Date.now() <= deadline.getTime(), deadlineLabel, deadlineIso: deadline ? deadline.toISOString() : null };
  },
  ["price-lock-campaign-v1"],
  { revalidate: 60, tags: [PRICE_LOCK_CACHE_TAG] }
);
