// アドオン(2026/10刷新)。DB: db/addons_v2.sql
//  月額: 全国TOPページPICKUP / 地域PICKUP(店の多い東京・大阪・福岡とその他で料金が違う。対象県はDBのmajor_area_prefs) / TOPページバナー
//  都度: スポット求人1件掲載 / 店舗紹介記事or動画作成 / ライター来店+記事作成 / YouTube撮影+動画投稿

export type AddonCode =
  | "job_listing"
  | "pickup_national"
  | "pickup_region"
  | "top_banner"
  | "dealer_scout"
  | "spot_job_credit"
  | "article_or_video"
  | "writer_visit"
  | "youtube";

export type AddonRow = {
  id: string;
  code: AddonCode | null;
  name: string;
  monthly_fee: number;
  major_area_fee: number | null;
  major_area_prefs: string[] | null;
  description: string | null;
  billing_type: "monthly" | "one_time";
  capacity: number | null;
  capacity_scope: "pref" | "national" | null;
  needs_fulfillment: boolean;
  active: boolean;
  sort_order: number;
};

export const ADDON_COLUMNS =
  "id, code, name, monthly_fee, major_area_fee, major_area_prefs, description, billing_type, capacity, capacity_scope, needs_fulfillment, active, sort_order";

export const DEFAULT_MAJOR_PREFS = ["東京都", "大阪府", "福岡県"];

/** 別料金の県の短い名前(例: 東京・大阪・福岡) */
export function majorAreaLabel(addon: Pick<AddonRow, "major_area_prefs">) {
  return (addon.major_area_prefs?.length ? addon.major_area_prefs : DEFAULT_MAJOR_PREFS).map((p) => p.replace(/[都府県]$/, "")).join("・");
}

export function isMajorArea(addon: Pick<AddonRow, "major_area_prefs">, pref: string | null | undefined) {
  if (!pref) return false;
  return (addon.major_area_prefs?.length ? addon.major_area_prefs : DEFAULT_MAJOR_PREFS).includes(pref);
}

/** 店舗の都道府県での料金(地域PICKUPは東京・大阪・福岡が別料金)。 */
export function addonFeeFor(addon: Pick<AddonRow, "monthly_fee" | "major_area_fee" | "major_area_prefs">, pref: string | null | undefined) {
  if (addon.major_area_fee != null && isMajorArea(addon, pref)) return addon.major_area_fee;
  return addon.monthly_fee;
}

// 店舗向けの画面・メール・請求書には、その店の都道府県の料金(addonFeeFor)だけを出す。
// 他の地域の料金(「東京・大阪・福岡は◯円/その他は◯円」など)は絶対に出さない(2026/10/21 オーナー指示)。
// 両方の料金を並べるのは運営の管理画面だけ。

export async function getActiveAddons(supabase: any): Promise<AddonRow[]> {
  const { data } = await supabase
    .from("addons")
    .select(ADDON_COLUMNS)
    .eq("active", true)
    .not("code", "is", null)
    .order("sort_order", { ascending: true });
  return (data ?? []) as AddonRow[];
}

/** 枠の残り(null = 無制限)。service-role で呼ぶこと(他店舗の契約を数えるため)。 */
export async function addonSlotsLeft(svc: any, addon: AddonRow, pref: string | null, excludeStoreId?: string) {
  if (addon.capacity == null) return null;
  const { data } = await svc
    .from("store_contract_addons")
    .select("store_contracts!inner(store_id, status, stores!inner(pref))")
    .eq("addon_id", addon.id)
    .eq("store_contracts.status", "active");
  const storeIds = new Set<string>();
  for (const row of (data ?? []) as any[]) {
    const c = Array.isArray(row.store_contracts) ? row.store_contracts[0] : row.store_contracts;
    const s = Array.isArray(c?.stores) ? c.stores[0] : c?.stores;
    if (!c || c.store_id === excludeStoreId) continue;
    if (addon.capacity_scope === "pref" && (s?.pref ?? null) !== (pref ?? null)) continue;
    storeIds.add(c.store_id);
  }
  return Math.max(0, addon.capacity - storeIds.size);
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "入金待ち",
  paid: "お支払い済み・対応待ち",
  in_progress: "対応中",
  completed: "完了",
  canceled: "取消",
};
