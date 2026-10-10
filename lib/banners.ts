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
// 管理画面の「表示位置」プルダウン・一覧表示で使う選択肢。値はbanners.position
// のCHECK制約('top'|'sidebar'|'footer'|'store_list'|'job_list'|'job_detail')
// と一致させること。
export const BANNER_POSITIONS = [
  { value: "top", label: "TOPページ（開催予定イベントの上）" },
  { value: "home_coupon", label: "TOPページ（お得なクーポンの上・横長1枚）" },
  { value: "home_community", label: "TOPページ（サミット情報交換の上・横並び4枚）" },
  { value: "home_ranking", label: "TOPページ（店舗ランキングの上・横長1枚）" },
  { value: "home_jobs", label: "TOPページ（新着求人・スポット求人の上・横長1枚）" },
  { value: "sidebar", label: "サイドバー" },
  { value: "footer", label: "フッター" },
  { value: "home_footer_three", label: "TOPページ（フッター上・横並び3枚）" },
  { value: "store_list", label: "店舗一覧" },
  { value: "job_list", label: "求人一覧" },
  { value: "job_detail", label: "求人詳細" },
] as const;

export type BannerPosition = (typeof BANNER_POSITIONS)[number]["value"];

export const BANNER_POSITION_LABEL: Record<string, string> = Object.fromEntries(
  BANNER_POSITIONS.map((p) => [p.value, p.label])
);

export const BANNER_BUCKET = "banners";

/**
 * TOPページのバナースライダー用。position='top'で画像があり、scope未設定
 * (全国向け)のものだけを表示順に返す。掲載期間外の行は公開RLSで返らないが、
 * 管理者でログインしているとRLS上は全行が見えてしまうため、active・掲載
 * 期間もここで明示的に絞る(pickBannerと同じ方針)。
 */
export async function getTopBanners(supabase: SupabaseClient): Promise<PickedBanner[]> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("banners")
    .select("id, title, image_url, link_url")
    .eq("position", "top")
    .eq("active", true)
    .is("scope", null)
    .not("image_url", "is", null)
    .neq("image_url", "")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as PickedBanner[];
}

// 自サイトとして扱うホスト(2026/10)。本番の独自ドメインと、以前から使って
// いるVercelのドメインのどちらのURLで登録されたリンクでも同じタブで開く。
const OWN_SITE_HOSTS = new Set(["pokersummit.jp", "www.pokersummit.jp", "poker-summit.vercel.app"]);

/**
 * バナーのリンク先が外部サイトか(true なら target="_blank" で開く)。
 * 相対URL、自サイトのドメイン、いま表示しているホスト(プレビューやローカル
 * 開発)へのリンクは内部扱い。URLとして解釈できない値は外部扱いにしない。
 */
export function isExternalBannerLink(linkUrl: string | null | undefined, requestHost: string): boolean {
  if (!linkUrl) return false;
  const current = requestHost.toLowerCase();
  try {
    const url = new URL(linkUrl, `https://${current || "localhost"}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.host.toLowerCase();
    return host !== current && !OWN_SITE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
/** 新しいTOPセクション直前の掲載枠。4枚枠は表示順の先頭4件。 */
export async function getHomeSectionBanners(
  supabase: SupabaseClient,
  position: "home_coupon" | "home_community" | "home_ranking" | "home_jobs" | "home_footer_three",
  limit = 1
): Promise<PickedBanner[]> {
  const now = new Date().toISOString();
  const { data } = await supabase.from("banners")
    .select("id, title, image_url, link_url")
    .eq("position", position).eq("active", true).is("scope", null)
    .not("image_url", "is", null).neq("image_url", "")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true }).limit(limit);
  return (data ?? []) as PickedBanner[];
}
