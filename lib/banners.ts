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
  const region = pref ? PREF_REGION[pref] || "" : opts.region || "";

  if (pref) {
    const match = banners.find((b) => b.scope === pref);
    if (match) return match;
  }
  if (region) {
    const match = banners.find((b) => b.scope === region);
    if (match) return match;
  }
  const unscoped = banners.find((b) => !b.scope);
  return unscoped ?? null;
}
