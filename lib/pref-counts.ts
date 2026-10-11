import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** 都道府県ごとの掲載店舗数(フッターの「都道府県から探す」用、1時間キャッシュ) */
export const getPrefStoreCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const svc = createServiceRoleClient();
    const counts: Record<string, number> = {};
    for (let from = 0; ; from += 1000) {
      const { data, error } = await svc.from("stores").select("pref").in("status", ["approved", "listed"]).range(from, from + 999);
      if (error || !data?.length) break;
      for (const r of data) if (r.pref) counts[r.pref] = (counts[r.pref] ?? 0) + 1;
      if (data.length < 1000) break;
    }
    return counts;
  },
  ["pref-store-counts"],
  { revalidate: 3600 }
);
