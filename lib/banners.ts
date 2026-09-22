import type { SupabaseClient } from "@supabase/supabase-js";
import { PREF_REGION } from "./constants";

export type PickedBanner = {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
};

/**
 * Mirrors the prototype's eligibleBanners()/pickBannerHtml(): among active banners
 * for a position, a pref-scoped banner wins over a region-scoped one, which wins
 * over an unscoped (shown-everywhere) one. Returns null when nothing is eligible,
 * in which case the caller shows nothing (no fake placeholder ad).
 */
export async function pickBanner(
  supabase: SupabaseClient,
  position: "store_list" | "job_list" | "job_detail",
  opts: { pref?: string; region?: string } = {}
): Promise<PickedBanner | null> {
  const now = new Date().toISOString();
  const { data: banners } = await supabase
    .from("banners")
    .select("id, title, image_url, link_url, scope, sort_order")
    .eq("position", position)
    .eq("active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("sort_order", { ascending: true });

  if (!banners || banners.length === 0) return null;

  const pref = opts.pref || "";
  // A prefecture can belong to more than one region (e.g. 三重県 is both 近畿
  // and 中部), so this is a list of candidate regions rather than a single one.
  const regions = pref ? PREF_REGION[pref] ?? [] : opts.region ? [opts.region] : [];

  let picked: PickedBanner | null = null;
  if (pref) {
    picked = banners.find((b) => b.scope === pref) ?? null;
  }
  if (!picked && regions.length > 0) {
    picked = banners.find((b) => b.scope && regions.includes(b.scope)) ?? null;
  }
  if (!picked) {
    picked = banners.find((b) => !b.scope) ?? null;
  }

  if (picked) {
    // Fire-and-forget impression log for the アクセス分析 banner tab (real data,
    // not the prototype's hardcoded impressions/clicks numbers).
    supabase
      .from("banner_impressions")
      .insert({ banner_id: picked.id })
      .then(() => {});
  }

  return picked;
}