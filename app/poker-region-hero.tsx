import Link from "next/link";
import type { ReactNode } from "react";
import { PREF_REGION, REGIONS } from "@/lib/constants";
import { REFERENCE_MAP_HITS } from "./region-map-paths";

type Stats = {
  storeCount: number;
  jobCount: number;
  memberCount: number;
  summitPostCount: number;
};

type Props = {
  searchControls: ReactNode;
  stats: Stats;
  backgroundSrc?: string;
};

// Region name -> CSS class suffix (Japanese names can't be used directly as
// class names). Keep in sync with REGIONS in lib/constants.ts — if a region
// name is ever added/renamed there, add/rename its entry here too.
const REGION_CLASS: Record<string, string> = {
  "北海道・東北": "hokkaido-tohoku",
  "関東": "kanto",
  "中部": "chubu",
  "近畿": "kinki",
  "中国": "chugoku",
  "四国": "shikoku",
  "九州・沖縄": "kyushu-okinawa",
};

// Label callout position (percentage of the 1640x960 panel) read off the
// approved comp image (no code source exists for these — the comp never
// rendered these as separate elements, only baked into the flat image).
// leaderTo is the on-map anchor the dashed line points to: the bounding-box
// center of that region's real prefecture geometry below, expressed in the
// same 1640x960 coordinate space (after the ps-region-map-fit transform).
// To move a LABEL, edit leftPct/topPct only. leaderTo is derived from the
// real map data and should only be regenerated if the map's fit transform
// (scale/translate on .ps-region-map-fit) ever changes.
const REGION_LABEL: Record<string, { leftPct: number; topPct: number; leaderTo: [number, number] }> = {
  "北海道・東北": { leftPct: 69.2, topPct: 14.7, leaderTo: [1089.8, 304.9] },
  "関東": { leftPct: 61.1, topPct: 46.6, leaderTo: [951.4, 604.4] },
  "中部": { leftPct: 38.9, topPct: 25.6, leaderTo: [874.6, 535.2] },
  "近畿": { leftPct: 52.6, topPct: 61.5, leaderTo: [794.7, 627.9] },
  "中国": { leftPct: 34.0, topPct: 43.1, leaderTo: [680.8, 601.7] },
  "四国": { leftPct: 41.8, topPct: 76.5, leaderTo: [706.2, 671.3] },
  "九州・沖縄": { leftPct: 12.2, topPct: 63.5, leaderTo: [583.8, 692.5] },
};

// Line-break groups for each region’s prefecture list under its tab, read
// off the approved comp image (e.g. 北海道・東北 wraps after 4 items, most
// others after 3, 四国 after 2) — kept as explicit per-region groupings
// rather than a single fixed chunk size because the comp itself doesn’t use
// one. Any prefecture beyond the last listed group falls onto one final
// extra line automatically (see chunkPrefs), so this never silently drops
// data if PREF_REGION ever gains an entry.
const PREF_LINE_BREAKS: Record<string, number[]> = {
  "北海道・東北": [4, 3],
  "関東": [3, 3, 1],
  "中部": [3, 3, 3, 1],
  "近畿": [3, 3, 1],
  "中国": [3, 2],
  "四国": [2, 2],
  "九州・沖縄": [3, 3, 2],
};

function chunkPrefs(prefs: string[], sizes: number[]): string[][] {
  const lines: string[][] = [];
  let idx = 0;
  for (const size of sizes) {
    if (idx >= prefs.length) break;
    lines.push(prefs.slice(idx, idx + size));
    idx += size;
  }
  if (idx < prefs.length) lines.push(prefs.slice(idx));
  return lines;
}

// Copy exactly as specified by the approved comp image. Every string that
// appears in the hero panel lives here — changing wording/region labels
// should never require touching the JSX below.
const HERO_COPY = {
  logoScript: "Poker Spots in Japan",
  headline: ["ポーカーがつなぐ", "新しい出会いを。", "日本のすみずみまで。"],
  verticalTagline: ["PLAY", "TRAVEL", "CONNECT"],
  rightHeadlinePrefix: "全国",
  rightHeadlineNumber: "47",
  rightHeadlineSuffix: "の地で",
  rightHeadlineLine2: ["ポーカーと", "出会える。"],
  rightTagline: ["MORE POKER", "A BIGGER JAPAN"],
  footerScript: ["Good Game", "Good People", "A Brighter Tomorrow"],
};

// Display priority only. Region membership and search links still come from PREF_REGION.
const HERO_PREF_ORDER: Record<string, string[]> = {
  "北海道・東北": ["北海道", "宮城県", "福島県", "青森県", "岩手県", "秋田県", "山形県"],
  "関東": ["東京都", "神奈川県", "埼玉県", "千葉県", "茨城県", "栃木県", "群馬県"],
  "中部": ["愛知県", "静岡県", "長野県", "新潟県", "岐阜県", "石川県", "富山県", "福井県", "山梨県", "三重県"],
  "近畿": ["大阪府", "京都府", "兵庫県", "奈良県", "滋賀県", "和歌山県", "三重県"],
  "中国": ["広島県", "岡山県", "山口県", "鳥取県", "島根県"],
  "四国": ["香川県", "愛媛県", "徳島県", "高知県"],
  "九州・沖縄": ["福岡県", "沖縄県", "熊本県", "長崎県", "大分県", "鹿児島県", "佐賀県", "宮崎県"],
};

function prefecturesFor(region: string): string[] {
  const prefs = Object.entries(PREF_REGION)
    .filter(([, regions]) => regions.includes(region))
    .map(([prefecture]) => prefecture);
  const order = HERO_PREF_ORDER[region] ?? [];
  return prefs.sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
  });
}

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function StoreIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3.5 9L4.5 4h15l1 5" />
      <path d="M3.5 9v10.5a1 1 0 0 0 1 1H10v-6.5h4V20.5h5.5a1 1 0 0 0 1-1V9" />
      <path d="M3.5 9h17" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="7.5" width="18" height="11.5" rx="2" />
      <path d="M8.5 7.5V5.8a1.8 1.8 0 0 1 1.8-1.8h3.4a1.8 1.8 0 0 1 1.8 1.8V7.5" />
      <path d="M3 13h18" />
    </svg>
  );
}

function MembersIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="7.2" r="3" />
      <path d="M6.3 20c0-3.3 2.6-5 5.7-5s5.7 1.7 5.7 5" />
      <circle cx="4.6" cy="9.4" r="2.1" />
      <path d="M1.3 19.3c0-2.2 1.5-3.7 3.3-4.1" />
      <circle cx="19.4" cy="9.4" r="2.1" />
      <path d="M22.7 19.3c0-2.2-1.5-3.7-3.3-4.1" />
    </svg>
  );
}

function SpeechBubbleIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9.8l-4.3 3.7v-3.7H4.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

/**
 * TOP page hero: 7-region tappable map + consolidated search/stats panel.
 * Visual spec (colors, layout, spacing, copy, map position) is fixed by the
 * approved comp/GPT code — see the .ps-region-hero rules in globals.css.
 * This component only wires that spec to real data/geometry:
 *  - PREF_REGION is the single region/prefecture source (labels, stats).
 *  - The map below is the real, accurate 47-prefecture SVG geometry from
 *    geolonia/japanese-prefectures (map-full.svg), NOT hand-drawn or
 *    approximated. Every <g data-code> block's transform/<title>/
 *    polygon|path data is preserved byte-for-byte from that source; the
 *    only additions are a className for CSS-driven coloring and the
 *    grouping <a> wrapper per region (derived from PREF_REGION, not from
 *    geolonia's own 8-way class grouping).
 *  - Each region's 1-to-N prefecture <g>s sit inside one <a
 *    href="/stores?region=..."> wrapper, so hovering/focusing/tapping ANY
 *    prefecture in a region highlights (and links) the whole region — see
 *    .ps-region-group / .ps-pref rules in globals.css.
 *  - The whole map is wrapped in one .ps-region-map-fit <g> that scales +
 *    positions the real (near-square) geometry to sit inside the same
 *    footprint the approved comp's map occupied in the 1640x960 panel —
 *    this is a pure fit transform (uniform scale + translate), not a
 *    reshape of any prefecture's geometry.
 *  - stats are real props, and searchControls is the site's existing
 *    /stores search form passed in unchanged (no new search logic here).
 */
export function PokerRegionHero({
  searchControls,
  stats,
  backgroundSrc = "/images/poker-region-hero-bg.png",
}: Props) {
  return (
    <section className="ps-region-hero" aria-label="全国からポーカー店舗を探す">
      {/* Decoration only (Fuji/cityscape/cherry blossoms/chips/cards) — no
          text, map, or numbers are baked into this image. */}
      <img className="ps-region-hero__bg" src={backgroundSrc} alt="" aria-hidden="true" />

      <div className="ps-region-hero__copy-left">
        <img className="ps-region-hero__logo-script" src="/images/hero-script-reference.png" alt={HERO_COPY.logoScript} />
        <h1 className="ps-region-hero__headline">
          {HERO_COPY.headline.map((line, i) => (
            <span key={line}>
              {line}
              {i < HERO_COPY.headline.length - 1 && <br />}
            </span>
          ))}
        </h1>
        <div className="ps-region-hero__vertical-tagline">
          {HERO_COPY.verticalTagline.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      </div>

      <div className="ps-region-hero__copy-right">
        <p className="ps-region-hero__right-headline">
          <span className="ps-region-hero__right-first-line">
            {HERO_COPY.rightHeadlinePrefix}<strong>{HERO_COPY.rightHeadlineNumber}</strong>{HERO_COPY.rightHeadlineSuffix}
          </span>
          {HERO_COPY.rightHeadlineLine2.map((line) => <span className="ps-region-hero__right-line" key={line}>{line}</span>)}
        </p>
        <div className="ps-region-hero__right-tagline">
          {HERO_COPY.rightTagline.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>

      <div className="ps-region-hero__footer-script" aria-hidden="true">
        {HERO_COPY.footerScript.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>

      <div className="ps-region-hero__search">{searchControls}</div>

      <svg
        className="ps-region-map-svg"
        viewBox="0 0 1640 960"
        preserveAspectRatio="xMidYMid meet"
        aria-label="7地方を選べる日本地図"
      >
        {REGIONS.map((region) => {
          const label = REGION_LABEL[region];
          return (
            <line
              key={region}
              x1={(label.leftPct / 100) * 1640}
              y1={(label.topPct / 100) * 960}
              x2={label.leaderTo[0]}
              y2={label.leaderTo[1]}
              className="ps-region-leader"
            />
          );
        })}
        <image
          href="/images/hero-map-reference.svg"
          x="392"
          y="60"
          width="892"
          height="892"
          className="ps-reference-map-image"
          aria-hidden="true"
        />
        {REGIONS.map((region) => (
          <a
            key={region}
            href={`/stores?region=${encodeURIComponent(region)}`}
            className={`ps-region-group ps-region-group--${REGION_CLASS[region]}`}
            aria-label={`${region}の店舗を見る`}
          >
            <path d={REFERENCE_MAP_HITS[region]} className="ps-reference-map-hit" />
          </a>
        ))}
      </svg>

      <nav className="ps-region-hero__labels" aria-label="地方から店舗を探す">
        {REGIONS.map((region) => {
          const prefs = prefecturesFor(region);
          const pos = REGION_LABEL[region];
          return (
            <Link
              key={region}
              href={`/stores?region=${encodeURIComponent(region)}`}
              className={`ps-region-label ps-region-label--${REGION_CLASS[region]}`}
              style={{ left: `${pos.leftPct}%`, top: `${pos.topPct}%` }}
            >
              <span className="ps-region-label__pill">
                {region}
              </span>
              <span className="ps-region-label__prefs">
                {chunkPrefs(prefs, PREF_LINE_BREAKS[region] ?? [3]).map((line, i) => (
                  <span key={i} className="ps-region-label__prefs-line">
                    {line.join("　")}
                  </span>
                ))}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="ps-region-stats" aria-label="Poker Summit 統計">
        <div className="ps-region-stat">
          <span className="ps-region-stat__icon" aria-hidden="true"><StoreIcon /></span>
          <span className="ps-region-stat__label">全国の掲載店舗数</span>
          <strong>{formatCount(stats.storeCount)}</strong>
        </div>
        <div className="ps-region-stat">
          <span className="ps-region-stat__icon" aria-hidden="true"><BriefcaseIcon /></span>
          <span className="ps-region-stat__label">掲載求人数</span>
          <strong>{formatCount(stats.jobCount)}</strong>
        </div>
        <div className="ps-region-stat">
          <span className="ps-region-stat__icon" aria-hidden="true"><MembersIcon /></span>
          <span className="ps-region-stat__label">会員数</span>
          <strong>{formatCount(stats.memberCount)}</strong>
        </div>
        <div className="ps-region-stat">
          <span className="ps-region-stat__icon" aria-hidden="true"><SpeechBubbleIcon /></span>
          <span className="ps-region-stat__label">サミット投稿数</span>
          <strong>{formatCount(stats.summitPostCount)}</strong>
        </div>
      </div>

      {/* Mobile-only fallback: real, visible, styled region cards (no tappable
          map on small screens per spec) — same PREF_REGION-driven data. */}
      <nav className="ps-region-mobile-list" aria-label="地方一覧">
        {REGIONS.map((region) => {
          const prefs = prefecturesFor(region);
          return (
            <Link
              key={region}
              href={`/stores?region=${encodeURIComponent(region)}`}
              className={`ps-region-mobile-card ps-region-mobile-card--${REGION_CLASS[region]}`}
            >
              <span className="ps-region-mobile-card__title">
                {region}
                <span aria-hidden="true">→</span>
              </span>
              <span className="ps-region-mobile-card__prefs">{prefs.join("　")}</span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
