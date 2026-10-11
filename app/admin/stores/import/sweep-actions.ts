"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { sweepArea } from "@/lib/store-sweep";
import { SWEEP_KEYWORDS } from "@/lib/sweep-areas";

// 都道府県を細かい地域に分けて、Google Placesで取りこぼしなく探す一括検索(2026/10)。
// 1回の検索は最大60件しか返らないため、地域を細かく区切って何度も検索する。
// 見つかった新しい候補は通常の取り込みと同じく status="pending"(承認待ち)で仮登録する。
// 座標はGoogleのものを保存せず(規約上30日まで)、国土地理院で取り直す(geo_source=null)。
export async function sweepImportArea(pref: string, area: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインしてください。");
  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) throw new Error("運営権限がありません。");

  const { found, inserted } = await sweepArea(supabase, pref, area, { keywords: SWEEP_KEYWORDS });
  await logAdminAction(supabase, "store_import_sweep", "store", undefined, { pref, area, found, inserted: inserted.length });
  revalidatePath("/admin/stores");
  return { found, inserted: inserted.length };
}
