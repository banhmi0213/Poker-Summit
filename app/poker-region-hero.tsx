import Link from "next/link";
import type { ReactNode } from "react";
import { PREF_REGION, REGIONS } from "@/lib/constants";

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
  "北海道・東北": { leftPct: 74.4, topPct: 12.7, leaderTo: [1145.8, 285.3] },
  "関東": { leftPct: 63.0, topPct: 55.1, leaderTo: [974.7, 655.8] },
  "中部": { leftPct: 37.5, topPct: 28.0, leaderTo: [879.7, 570.2] },
  "近畿": { leftPct: 48.9, topPct: 65.0, leaderTo: [781.0, 684.7] },
  "中国": { leftPct: 26.2, topPct: 50.3, leaderTo: [640.0, 652.4] },
  "四国": { leftPct: 32.4, topPct: 79.1, leaderTo: [671.5, 738.4] },
  "九州・沖縄": { leftPct: 9.1, topPct: 71.3, leaderTo: [629.6, 475.2] },
};

// Copy exactly as specified by the approved comp image. Every string that
// appears in the hero panel lives here — changing wording/region labels
// should never require touching the JSX below.
const HERO_COPY = {
  logoScript: "Poker Spots in Japan",
  headline: ["ポーカーがつなぐ、", "新しい出会いを。", "日本のすみずみまで。"],
  verticalTagline: ["PLAY", "TRAVEL", "CONNECT"],
  rightHeadlinePrefix: "全国",
  rightHeadlineNumber: "47",
  rightHeadlineSuffix: "の地で、",
  rightHeadlineLine2: "ポーカーと出会える。",
  rightTagline: ["MORE POKER", "A BIGGER JAPAN"],
  footerScript: ["Good Game", "Good People", "A Brighter Tomorrow"],
};

function prefecturesFor(region: string): string[] {
  return Object.entries(PREF_REGION)
    .filter(([, regions]) => regions.includes(region))
    .map(([prefecture]) => prefecture);
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
        <div className="ps-region-hero__logo-script">{HERO_COPY.logoScript}</div>
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
          {HERO_COPY.rightHeadlinePrefix}
          <strong>{HERO_COPY.rightHeadlineNumber}</strong>
          {HERO_COPY.rightHeadlineSuffix}
          <br />
          {HERO_COPY.rightHeadlineLine2}
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
        aria-hidden="true"
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
        {/* Real 47-prefecture geometry (geolonia/japanese-prefectures,
            map-full.svg), grouped into the 7 PREF_REGION regions. Fit into
            the comp's map footprint via a uniform scale+translate — the
            geometry itself is untouched. */}
        <g className="ps-region-map-fit" transform="translate(430.000,15.000) scale(0.913920)">
          <g className="svg-map" transform="matrix(1.028807, 0, 0, 1.028807, -47.544239, -28.806583)">
            <g className="prefectures" transform="matrix(1, 0, 0, 1, 6, 18)">
        <a
          href={`/stores?region=${encodeURIComponent("北海道・東北")}`}
          className="ps-region-group ps-region-group--hokkaido-tohoku"
          aria-label="北海道・東北の店舗を見る"
        >
          {/* 1: 北海道 */}
          <g className="ps-pref ps-pref--hokkaido-tohoku" data-code="1" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(602.000000, 10.000000)">
            <title>北海道 / Hokkaido</title>
        <path d="M4,240 L3,245 L0,246 L0,237 L6,235 L4,240 Z M33,261 L32,250 L28,243 L23,242 L21,237 L17,236 L15,231 L19,223 L17,212 L19,209 L28,207 L34,198 L37,202 L39,201 L43,192 L49,187 L39,173 L40,166 L47,164 L60,174 L71,171 L71,174 L78,177 L83,174 L89,165 L83,140 L86,135 L93,132 L97,126 L96,103 L100,95 L101,85 L98,67 L90,48 L93,39 L92,33 L94,36 L99,35 L105,28 L131,55 L139,68 L155,85 L184,104 L213,109 L214,113 L219,118 L238,118 L260,91 L262,96 L252,119 L252,129 L255,135 L265,138 L263,140 L264,137 L258,137 L263,149 L269,156 L273,157 L280,149 L287,148 L277,156 L275,163 L258,166 L256,172 L252,177 L247,177 L245,175 L246,173 L243,172 L240,178 L243,180 L228,181 L220,178 L205,186 L191,202 L182,216 L179,225 L180,240 L178,248 L164,237 L141,228 L113,211 L100,209 L103,206 L88,214 L72,230 L69,227 L73,227 L68,226 L66,220 L58,212 L47,213 L42,220 L39,230 L40,234 L52,242 L62,242 L71,254 L80,257 L82,260 L76,265 L72,267 L63,263 L60,265 L60,261 L57,260 L55,265 L48,269 L48,278 L40,282 L37,287 L30,284 L27,278 L28,269 L33,261 Z M71,48 L73,45 L77,47 L79,52 L75,55 L71,52 L71,48 Z M65,35 L65,33 L67,35 L66,45 L63,35 L65,35 Z M369,17 L367,13 L365,13 L363,17 L365,23 L364,26 L359,28 L357,35 L350,34 L351,41 L341,50 L341,54 L335,54 L335,56 L339,58 L339,62 L336,65 L332,64 L332,69 L329,66 L330,71 L327,78 L331,79 L336,70 L341,69 L346,59 L356,50 L358,40 L363,43 L369,41 L384,24 L397,15 L406,13 L407,10 L404,6 L407,2 L402,0 L396,2 L384,20 L373,22 L369,17 Z M290,99 L295,93 L303,91 L308,84 L311,85 L314,79 L304,82 L296,77 L293,79 L289,89 L280,104 L280,107 L266,122 L268,129 L273,128 L273,132 L274,119 L282,114 L283,109 L286,109 L287,102 L290,99 Z M322,125 L334,115 L329,113 L325,116 L326,117 L319,119 L319,123 L321,122 L322,125 Z M300,142 L304,137 L297,139 L300,142 Z M291,146 L293,143 L289,144 L291,146 Z"/>
          </g>
          {/* 2: 青森県 */}
          <g className="ps-pref ps-pref--hokkaido-tohoku" data-code="2" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(624.000000, 287.000000)">
            <title>青森 / Aomori</title>
        <polygon points="3 71 3 63 0 60 6 51 12 51 18 47 21 31 17 27 20 26 21 19 27 23 31 20 35 23 37 38 40 45 46 41 45 37 47 33 58 42 61 39 65 23 61 16 55 22 41 25 47 0 64 11 73 6 71 37 73 51 77 62 81 61 86 67 80 74 75 72 71 75 69 72 56 82 52 81 53 70 48 70 48 65 38 72 35 70 32 72 25 67 22 70 10 68 7 72"/>
          </g>
          {/* 3: 岩手県 */}
          <g className="ps-pref ps-pref--hokkaido-tohoku" data-code="3" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(664.000000, 354.000000)">
            <title>岩手 / Iwate</title>
        <polygon points="48 92 41 91 39 105 33 102 29 107 23 103 25 99 17 100 7 95 8 89 5 84 8 81 0 68 3 57 7 51 5 46 8 42 5 38 10 37 8 19 12 14 16 15 29 5 31 8 35 5 40 7 46 0 54 11 52 16 57 19 55 23 61 28 64 43 62 53 65 49 66 54 68 55 62 60 64 62 67 59 67 63 63 63 63 68 60 69 65 68 60 71 62 73 60 75 64 74 58 81 62 83 57 83 60 86 57 86 59 88 53 89 52 86 54 91 52 91 52 94 50 90"/>
          </g>
          {/* 4: 宮城県 */}
          <g className="ps-pref ps-pref--hokkaido-tohoku" data-code="4" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(648.000000, 445.000000)">
            <title>宮城 / Miyagi</title>
        <path d="M33,70 L29,70 L29,76 L25,76 L26,78 L21,76 L20,70 L11,70 L7,66 L1,66 L0,61 L7,59 L10,53 L9,47 L16,35 L12,24 L15,24 L17,16 L12,8 L16,9 L23,4 L33,9 L41,8 L39,12 L45,16 L49,11 L55,14 L57,0 L64,1 L67,8 L62,5 L63,10 L59,14 L62,19 L60,17 L56,20 L60,22 L57,28 L61,28 L61,32 L58,30 L60,34 L57,35 L58,38 L61,37 L59,39 L61,41 L61,45 L57,43 L58,40 L55,41 L57,39 L56,37 L39,40 L36,43 L40,45 L35,46 L38,47 L32,57 L33,70 Z M43,41 L44,43 L42,43 L43,41 Z"/>
          </g>
          {/* 5: 秋田県 */}
          <g className="ps-pref ps-pref--hokkaido-tohoku" data-code="5" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(617.000000, 352.000000)">
            <title>秋田 / Akita</title>
        <polygon points="54 97 47 102 43 101 39 100 37 95 23 92 19 87 9 88 11 78 16 69 17 47 11 39 3 42 0 33 6 36 12 28 15 19 15 11 10 6 14 7 17 3 29 5 32 2 39 7 42 5 45 7 55 0 55 5 60 5 59 16 55 21 57 39 52 40 55 44 52 48 54 53 50 59 47 70 55 83 52 86 55 91"/>
          </g>
          {/* 6: 山形県 */}
          <g className="ps-pref ps-pref--hokkaido-tohoku" data-code="6" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(612.000000, 439.000000)">
            <title>山形 / Yamagata</title>
        <polygon points="14 1 24 0 28 5 42 8 44 13 48 14 53 22 51 30 48 30 52 41 45 53 46 59 43 65 36 67 37 72 36 81 38 82 35 86 29 87 26 85 22 86 20 82 14 83 7 81 4 76 7 68 7 60 15 57 17 53 8 47 8 40 0 37 13 14"/>
          </g>
          {/* 7: 福島県 */}
          <g className="ps-pref ps-pref--hokkaido-tohoku" data-code="7" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(594.000000, 511.000000)">
            <title>福島 / Fukushima</title>
        <polygon points="82 69 72 64 72 68 66 74 56 65 55 59 49 55 37 52 12 68 4 66 5 52 0 47 4 41 2 37 3 34 12 33 13 30 21 30 19 21 28 11 25 9 32 11 38 10 40 14 44 13 47 15 53 14 56 10 54 9 55 0 61 0 65 4 74 4 75 10 80 12 79 10 83 10 83 4 87 4 93 18 93 45 91 61"/>
          </g>
        </a>
        <a
          href={`/stores?region=${encodeURIComponent("関東")}`}
          className="ps-region-group ps-region-group--kanto"
          aria-label="関東の店舗を見る"
        >
          {/* 8: 茨城県 */}
          <g className="ps-pref ps-pref--kanto" data-code="8" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(622.000000, 575.000000)">
            <title>茨城 / Ibaraki</title>
        <polygon points="5 54 5 54 2 55 0 48 7 45 8 41 11 41 14 36 25 34 28 27 26 17 29 15 28 12 28 1 38 10 44 4 44 0 54 5 46 29 47 35 44 42 46 52 51 61 49 63 51 66 52 62 60 74 42 62 42 65 24 69 13 64"/>
          </g>
          {/* 9: 栃木県 */}
          <g className="ps-pref ps-pref--kanto" data-code="9" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(603.000000, 563.000000)">
            <title>栃木 / Tochigi</title>
        <polygon points="19 60 18 59 16 55 7 56 2 49 8 36 0 33 1 24 4 21 1 19 3 16 28 0 40 3 46 7 47 13 47 24 48 27 45 29 47 39 44 46 33 48 30 53 27 53 26 57"/>
          </g>
          {/* 10: 群馬県 */}
          <g className="ps-pref ps-pref--kanto" data-code="10" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(557.000000, 570.000000)">
            <title>群馬 / Gunma</title>
        <polygon points="64 52 54 54 48 50 37 48 32 58 16 67 12 65 12 59 9 56 12 55 10 49 13 47 12 41 3 41 0 36 1 29 6 25 5 23 14 20 26 14 26 11 29 10 28 5 32 4 34 0 41 7 49 9 47 12 50 14 47 17 46 26 54 29 48 42 53 49 62 48"/>
          </g>
          {/* 11: 埼玉県 */}
          <g className="ps-pref ps-pref--kanto" data-code="11" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(573.000000, 618.000000)">
            <title>埼玉 / Saitama</title>
        <polygon points="48 4 49 5 51 12 54 11 54 11 60 24 60 31 54 29 52 31 48 30 42 33 42 29 35 32 30 28 15 24 12 27 1 24 0 19 16 10 21 0 32 2 38 6"/>
          </g>
          {/* 12: 千葉県 */}
          <g className="ps-pref ps-pref--kanto" data-code="12" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(627.000000, 629.000000)">
            <title>千葉 / Chiba</title>
        <polygon points="5 29 7 25 6 20 6 13 0 0 8 10 19 15 37 11 37 8 55 20 55 24 45 24 34 35 32 57 19 61 7 75 0 71 5 69 3 66 4 63 3 58 5 53 1 49 4 45 7 46 7 42 13 39 18 33 11 26 6 30"/>
          </g>
          {/* 13: 東京都 */}
          <g className="ps-pref ps-pref--kanto" data-code="13" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(585.000000, 642.000000)">
            <title>東京 / Tokyo</title>
        <path d="M49,173 L49,178 L44,171 L49,173 Z M34,113 L32,115 L29,114 L31,111 L34,113 Z M11,104 L13,106 L11,107 L11,104 Z M18,98 L16,96 L18,92 L18,98 Z M22,75 L22,69 L26,70 L26,76 L22,75 Z M48,7 L49,12 L47,16 L41,15 L43,19 L39,20 L43,20 L43,23 L29,16 L26,18 L29,20 L27,20 L27,25 L23,20 L9,14 L4,11 L0,3 L3,0 L18,4 L23,8 L30,5 L30,9 L36,6 L40,7 L42,5 L48,7 Z"/>
          </g>
          {/* 14: 神奈川県 */}
          <g className="ps-pref ps-pref--kanto" data-code="14" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(584.000000, 656.000000)">
            <title>神奈川 / Kanagawa</title>
        <polygon points="10 0 24 6 28 11 28 6 30 6 27 4 30 2 44 9 40 13 36 12 39 16 36 16 36 23 42 26 38 30 39 33 35 33 36 28 33 24 26 22 15 25 11 28 12 34 10 34 4 30 4 17 0 17 9 9"/>
          </g>
        </a>
        <a
          href={`/stores?region=${encodeURIComponent("中部")}`}
          className="ps-region-group ps-region-group--chubu"
          aria-label="中部の店舗を見る"
        >
          {/* 15: 新潟県 */}
          <g className="ps-pref ps-pref--chubu" data-code="15" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(518.000000, 476.000000)">
            <title>新潟 / Niigata</title>
        <path d="M7,113 L4,102 L0,99 L14,94 L23,87 L30,87 L45,75 L55,60 L60,46 L79,34 L80,36 L79,35 L85,28 L94,0 L102,3 L102,10 L111,16 L109,20 L101,23 L101,31 L98,39 L101,44 L104,46 L95,56 L97,65 L89,65 L88,68 L79,69 L78,72 L80,76 L76,82 L81,87 L80,101 L73,94 L71,98 L67,99 L68,104 L65,105 L65,108 L53,114 L53,107 L48,103 L48,98 L45,96 L38,98 L33,103 L33,108 L29,106 L21,110 L19,109 L19,104 L12,103 L12,106 L7,113 Z M36,46 L28,47 L35,38 L33,35 L30,37 L30,31 L34,23 L43,14 L39,30 L46,31 L43,40 L36,46 Z"/>
          </g>
          {/* 16: 富山県 */}
          <g className="ps-pref ps-pref--chubu" data-code="16" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(475.000000, 575.000000)">
            <title>富山 / Toyama</title>
        <polygon points="41 37 31 33 27 35 27 33 22 35 19 33 10 44 9 40 5 38 1 43 0 35 2 27 1 23 3 20 1 16 4 14 6 4 14 2 11 8 23 15 31 11 33 3 43 0 47 3 50 14 49 25 46 26 47 29"/>
          </g>
          {/* 17: 石川県 */}
          <g className="ps-pref ps-pref--chubu" data-code="17" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(448.000000, 541.000000)">
            <title>石川 / Ishikawa</title>
        <path d="M37,26 L34,23 L41,23 L37,26 Z M28,77 L31,80 L26,90 L21,91 L16,86 L6,85 L0,77 L15,62 L26,44 L27,33 L25,29 L25,24 L22,23 L27,10 L52,0 L56,1 L57,5 L51,6 L50,15 L46,14 L39,22 L37,18 L34,19 L32,28 L38,30 L41,26 L41,36 L33,38 L31,48 L28,50 L30,54 L28,57 L29,61 L27,69 L28,77 Z"/>
          </g>
          {/* 18: 福井県 */}
          <g className="ps-pref ps-pref--chubu" data-code="18" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(408.000000, 618.000000)">
            <title>福井 / Fukui</title>
        <polygon points="40 0 46 8 56 9 61 14 66 13 64 19 70 27 67 31 54 32 53 34 47 31 42 40 35 37 36 45 33 44 33 47 27 50 24 48 21 55 18 54 15 58 3 56 0 51 1 45 3 49 10 46 6 49 13 50 15 47 13 48 13 45 19 47 17 45 20 43 18 40 26 41 25 35 28 33 29 38 31 39 32 32 25 19 34 6 34 2"/>
          </g>
          {/* 19: 山梨県 */}
          <g className="ps-pref ps-pref--chubu" data-code="19" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(546.000000, 638.000000)">
            <title>山梨 / Yamanashi</title>
        <polygon points="2 21 0 16 3 14 0 11 10 0 15 5 21 3 25 6 28 4 39 7 43 15 48 18 47 27 38 35 26 38 21 33 17 41 18 48 13 50 9 41 4 40 5 29"/>
          </g>
          {/* 20: 長野県 */}
          <g className="ps-pref ps-pref--chubu" data-code="20" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(503.000000, 572.000000)">
            <title>長野 / Nagano</title>
        <polygon points="68 18 59 21 60 23 55 27 54 34 57 39 66 39 67 45 64 47 66 53 63 54 66 57 66 63 70 65 71 70 68 72 64 69 58 71 53 66 43 77 46 80 43 82 45 87 41 92 41 104 26 114 18 112 13 115 12 109 14 106 12 102 15 102 13 99 15 95 9 89 11 86 6 79 0 76 2 71 7 71 13 64 14 60 11 56 16 46 13 40 19 32 18 29 21 28 22 17 27 10 27 7 34 8 34 13 36 14 44 10 48 12 48 7 53 2 60 0 63 2 63 7 68 11"/>
          </g>
          {/* 21: 岐阜県 */}
          <g className="ps-pref ps-pref--chubu" data-code="21" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(450.000000, 608.000000)">
            <title>岐阜 / Gifu</title>
        <polygon points="66 4 69 10 64 20 67 24 66 28 60 35 55 35 53 40 59 43 64 50 62 53 68 59 66 63 68 66 65 66 67 70 65 73 58 77 52 73 45 75 40 73 34 65 24 68 20 76 19 82 12 75 6 77 4 76 8 66 7 63 4 56 1 56 0 50 5 41 11 44 12 42 25 41 28 37 22 29 24 23 29 13 26 10 30 5 34 7 35 11 44 0 47 2 52 0 52 2 56 0"/>
          </g>
          {/* 22: 静岡県 */}
          <g className="ps-pref ps-pref--chubu" data-code="22" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(511.000000, 659.000000)">
            <title>静岡 / Shizuoka</title>
        <polygon points="73 14 77 14 77 27 83 31 81 36 85 42 85 46 78 55 77 61 70 65 64 59 67 45 65 41 66 38 72 37 62 31 55 33 51 38 53 41 44 45 42 54 36 61 38 65 25 61 0 60 0 52 8 47 18 27 33 17 33 5 37 0 40 8 39 19 44 20 48 29 53 27 52 20 56 12 61 17"/>
          </g>
          {/* 23: 愛知県 */}
          <g className="ps-pref ps-pref--chubu" data-code="23" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(469.000000, 673.000000)">
            <title>愛知 / Aichi</title>
        <polygon points="42 46 18 52 20 47 23 49 31 43 33 46 35 43 34 40 28 37 26 41 18 40 14 37 16 29 12 40 16 45 13 45 9 41 10 36 8 33 8 28 12 21 5 25 0 17 1 11 5 3 15 0 21 8 26 10 33 8 39 12 46 8 47 14 52 11 60 13 50 33 42 38"/>
          </g>
        </a>
        <a
          href={`/stores?region=${encodeURIComponent("近畿")}`}
          className="ps-region-group ps-region-group--kinki"
          aria-label="近畿の店舗を見る"
        >
          {/* 24: 三重県 */}
          <g className="ps-pref ps-pref--kinki" data-code="24" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(426.000000, 683.000000)">
            <title>三重 / Mie</title>
        <polygon points="8 95 3 92 0 86 1 86 1 83 3 83 8 80 8 77 13 76 14 73 13 66 15 62 13 59 15 58 12 53 20 47 11 42 12 38 10 37 13 36 11 32 10 28 13 27 14 22 21 25 27 22 31 12 30 2 36 0 43 7 48 15 42 16 43 20 36 32 35 40 51 47 53 52 56 51 55 55 50 55 55 56 55 61 51 62 53 60 50 58 49 60 43 61 46 57 42 57 39 62 39 60 36 63 34 61 34 64 32 62 25 66 22 68 23 73 21 72 22 70 18 73 22 77 20 77 22 80 19 78 20 81 13 85"/>
          </g>
          {/* 25: 滋賀県 */}
          <g className="ps-pref ps-pref--kinki" data-code="25" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(423.000000, 655.000000)">
            <title>滋賀 / Shiga</title>
        <path d="M20,0 L27,3 L28,9 L31,9 L34,16 L35,19 L31,29 L33,30 L34,40 L30,50 L24,53 L17,50 L16,55 L13,56 L9,50 L5,50 L2,40 L5,26 L0,21 L3,17 L6,18 L9,11 L12,13 L18,10 L18,7 L21,8 L20,0 Z M20,13 L20,16 L18,13 L14,16 L16,24 L8,32 L8,36 L5,42 L7,45 L9,36 L15,35 L16,31 L25,25 L26,21 L20,13 Z"/>
          </g>
          {/* 26: 京都府 */}
          <g className="ps-pref ps-pref--kinki" data-code="26" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(377.000000, 649.000000)">
            <title>京都 / Kyoto</title>
        <polygon points="44 63 41 55 37 54 38 51 34 54 26 46 27 41 17 39 15 32 10 34 3 29 4 23 10 23 10 17 9 15 4 16 0 11 1 7 3 10 2 8 19 0 23 7 15 14 18 15 20 11 20 15 24 17 23 21 25 18 27 19 25 14 31 11 32 14 31 20 34 25 46 27 51 32 48 46 51 56 55 56 59 62 60 66 58 68 54 65 50 68"/>
          </g>
          {/* 27: 大阪府 */}
          <g className="ps-pref ps-pref--kinki" data-code="27" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(387.000000, 695.000000)">
            <title>大阪 / Osaka</title>
        <polygon points="16 0 24 8 28 5 27 8 31 9 34 17 29 28 31 37 29 42 3 48 0 45 7 44 14 37 17 28 19 30 17 22 20 20 18 9 20 8 14 5 13 1"/>
          </g>
          {/* 28: 兵庫県 */}
          <g className="ps-pref ps-pref--kinki" data-code="28" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(345.000000, 655.000000)">
            <title>兵庫 / Hyogo</title>
        <path d="M31,90 L23,93 L23,88 L20,89 L20,86 L38,67 L39,69 L32,79 L35,88 L31,90 Z M3,59 L4,56 L0,50 L2,47 L1,40 L9,32 L8,26 L14,24 L14,20 L7,3 L16,0 L33,1 L32,5 L36,10 L41,9 L42,11 L42,17 L36,17 L35,23 L42,28 L47,26 L49,33 L59,35 L58,40 L55,41 L56,45 L62,48 L60,49 L62,60 L59,62 L53,60 L40,66 L25,56 L11,57 L11,53 L8,58 L5,56 L3,59 Z"/>
          </g>
          {/* 29: 奈良県 */}
          <g className="ps-pref ps-pref--kinki" data-code="29" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(410.000000, 712.000000)">
            <title>奈良 / Nara</title>
        <polygon points="24 48 19 51 19 54 17 54 17 57 16 57 3 55 5 49 0 42 6 35 10 34 6 25 8 20 6 11 11 0 17 5 21 2 25 5 27 3 29 7 26 8 28 9 27 13 36 18 28 24 31 29 29 30 31 33 29 37 30 44 29 47"/>
          </g>
          {/* 30: 和歌山県 */}
          <g className="ps-pref ps-pref--kinki" data-code="30" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(385.000000, 737.000000)">
            <title>和歌山 / Wakayama</title>
        <path d="M41,32 L44,38 L49,41 L45,46 L46,50 L38,55 L37,59 L35,59 L36,56 L19,51 L14,44 L17,41 L9,37 L4,30 L0,30 L3,25 L0,24 L6,21 L1,18 L5,16 L4,14 L8,14 L0,6 L2,3 L5,6 L31,0 L35,9 L31,10 L25,17 L30,24 L28,30 L41,32 Z M49,23 L49,26 L44,29 L44,26 L49,23 Z"/>
          </g>
        </a>
        <a
          href={`/stores?region=${encodeURIComponent("中国")}`}
          className="ps-region-group ps-region-group--chugoku"
          aria-label="中国の店舗を見る"
        >
          {/* 31: 鳥取県 */}
          <g className="ps-pref ps-pref--chugoku" data-code="31" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(288.000000, 658.000000)">
            <title>鳥取 / Tottori</title>
        <polygon points="7 33 0 31 4 25 2 22 10 20 11 11 5 3 7 2 9 6 15 8 23 4 34 6 55 5 64 0 71 17 71 21 65 23 53 27 52 21 45 18 46 16 36 22 32 17 25 15 22 21 20 22 21 25 14 25 15 29 8 30"/>
          </g>
          {/* 32: 島根県 */}
          <g className="ps-pref ps-pref--chugoku" data-code="32" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(211.000000, 610.000000)">
            <title>島根 / Shimane</title>
        <path d="M74,14 L78,13 L75,17 L72,15 L73,19 L71,16 L74,14 Z M79,16 L77,19 L77,15 L79,14 L81,17 L79,16 Z M83,5 L88,0 L93,5 L92,9 L89,9 L91,11 L86,12 L83,5 Z M2,100 L10,98 L25,84 L35,78 L41,70 L52,65 L55,59 L53,55 L70,51 L76,46 L79,49 L87,48 L84,50 L82,51 L88,59 L87,68 L79,70 L81,73 L77,79 L64,77 L57,85 L51,88 L54,93 L46,95 L41,93 L39,96 L31,94 L25,99 L26,101 L24,107 L19,112 L21,114 L17,116 L18,120 L15,124 L13,122 L7,124 L5,120 L7,115 L2,115 L0,111 L4,106 L2,100 Z"/>
          </g>
          {/* 33: 岡山県 */}
          <g className="ps-pref ps-pref--chugoku" data-code="33" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(295.000000, 673.000000)">
            <title>岡山 / Okayama</title>
        <polygon points="58 8 59 14 51 22 52 29 50 32 54 38 53 41 46 39 49 42 43 49 34 48 39 49 36 53 34 52 33 57 27 55 25 58 23 52 23 55 19 51 15 55 10 52 12 56 8 54 4 38 5 33 1 28 3 21 0 18 1 15 8 14 7 10 14 10 13 7 15 6 18 0 25 2 29 7 39 1 38 3 45 6 46 12"/>
          </g>
          {/* 34: 広島県 */}
          <g className="ps-pref ps-pref--chugoku" data-code="34" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(230.000000, 687.000000)">
            <title>広島 / Hiroshima</title>
        <path d="M73,40 L72,42 L69,40 L72,43 L70,42 L68,47 L63,45 L63,42 L54,44 L51,48 L39,49 L37,53 L30,55 L28,53 L25,56 L26,53 L23,47 L25,45 L17,44 L9,51 L10,54 L5,52 L4,46 L2,44 L2,37 L0,35 L5,30 L7,24 L6,22 L12,17 L20,19 L22,16 L27,18 L35,16 L32,11 L38,8 L45,0 L58,2 L65,4 L68,7 L66,14 L70,19 L69,24 L73,40 Z M45,53 L43,56 L41,53 L46,51 L45,53 Z M21,54 L20,50 L23,51 L22,59 L19,59 L21,56 L17,51 L21,54 Z M15,48 L16,50 L12,52 L15,48 Z M35,57 L33,56 L36,56 L35,57 Z M24,58 L26,58 L25,61 L28,61 L26,63 L20,62 L23,56 L26,56 L24,58 Z M59,49 L59,52 L56,49 L59,49 Z M57,50 L53,52 L54,50 L57,50 Z M60,44 L62,45 L59,47 L60,44 Z"/>
          </g>
          {/* 35: 山口県 */}
          <g className="ps-pref ps-pref--chugoku" data-code="35" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(168.000000, 710.000000)">
            <title>山口 / Yamaguchi</title>
        <path d="M45,0 L47,6 L43,11 L45,15 L50,15 L48,20 L50,24 L56,22 L58,24 L61,20 L60,16 L64,14 L64,21 L66,23 L67,29 L72,31 L72,36 L69,36 L70,44 L65,46 L65,54 L61,48 L57,48 L52,42 L47,44 L50,41 L46,38 L35,42 L32,39 L30,42 L29,40 L27,42 L27,38 L25,43 L21,45 L19,43 L16,45 L15,40 L9,36 L3,43 L3,36 L0,32 L4,27 L1,21 L4,17 L10,17 L5,15 L7,12 L16,14 L17,17 L24,17 L30,15 L29,12 L41,1 L43,2 L45,0 Z M64,54 L59,56 L62,52 L64,54 Z M75,50 L83,48 L78,50 L77,53 L73,50 L69,53 L67,48 L70,46 L75,50 Z M18,15 L18,13 L22,14 L18,15 Z M51,46 L48,46 L51,43 L51,46 Z"/>
          </g>
        </a>
        <a
          href={`/stores?region=${encodeURIComponent("四国")}`}
          className="ps-region-group ps-region-group--shikoku"
          aria-label="四国の店舗を見る"
        >
          {/* 36: 徳島県 */}
          <g className="ps-pref ps-pref--shikoku" data-code="36" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(312.000000, 744.000000)">
            <title>徳島 / Tokushima</title>
        <path d="M50,2 L52,0 L51,4 L50,2 Z M41,2 L49,0 L49,3 L52,4 L48,13 L55,20 L50,24 L57,26 L38,36 L33,43 L27,42 L25,38 L27,34 L20,33 L19,25 L13,27 L0,21 L2,13 L11,7 L18,10 L27,3 L40,5 L41,2 Z"/>
          </g>
          {/* 37: 香川県 */}
          <g className="ps-pref ps-pref--shikoku" data-code="37" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(308.000000, 724.000000)">
            <title>香川 / Kagawa</title>
        <path d="M6,33 L1,31 L4,21 L0,17 L6,20 L19,10 L26,13 L30,9 L31,14 L34,11 L37,14 L36,17 L45,22 L44,25 L31,23 L22,30 L15,27 L6,33 Z M27,5 L25,4 L29,4 L27,5 Z M40,0 L42,0 L40,8 L38,7 L38,5 L35,9 L35,5 L31,3 L40,0 Z"/>
          </g>
          {/* 38: 愛媛県 */}
          <g className="ps-pref ps-pref--shikoku" data-code="38" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(225.000000, 737.000000)">
            <title>愛媛 / Ehime</title>
        <path d="M34,21 L31,20 L35,17 L34,21 Z M55,6 L51,6 L55,0 L57,3 L55,6 Z M60,5 L61,5 L60,7 L57,6 L60,5 Z M58,10 L54,12 L55,7 L60,8 L58,10 Z M32,85 L25,83 L25,86 L23,86 L24,81 L27,82 L21,76 L24,76 L22,72 L25,72 L22,71 L23,69 L20,67 L24,70 L28,66 L28,63 L24,63 L27,60 L19,60 L21,57 L19,56 L22,51 L16,50 L8,56 L0,57 L35,37 L41,18 L50,15 L48,11 L51,10 L59,24 L70,20 L80,22 L84,18 L89,20 L87,28 L63,32 L56,41 L53,51 L42,52 L46,61 L41,64 L35,72 L31,69 L34,82 L32,85 Z"/>
          </g>
          {/* 39: 高知県 */}
          <g className="ps-pref ps-pref--shikoku" data-code="39" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(251.000000, 765.000000)">
            <title>高知 / Kochi</title>
        <path d="M61,0 L74,6 L80,4 L81,12 L88,13 L86,17 L88,21 L94,22 L87,41 L75,25 L65,21 L55,23 L55,21 L56,24 L44,28 L50,28 L44,29 L42,32 L41,29 L38,33 L39,38 L37,44 L34,44 L30,52 L25,53 L25,61 L22,64 L25,70 L21,66 L14,68 L9,65 L5,67 L6,61 L10,60 L9,57 L6,57 L8,54 L5,41 L9,44 L15,36 L20,33 L16,24 L27,23 L30,13 L37,4 L61,0 Z M1,69 L0,70 L0,67 L1,69 Z"/>
          </g>
        </a>
        <a
          href={`/stores?region=${encodeURIComponent("九州・沖縄")}`}
          className="ps-region-group ps-region-group--kyushu-okinawa"
          aria-label="九州・沖縄の店舗を見る"
        >
          {/* 40: 福岡県 */}
          <g className="ps-pref ps-pref--kyushu-okinawa" data-code="40" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(123.000000, 752.000000)">
            <title>福岡 / Fukuoka</title>
        <polygon points="40 53 32 48 31 52 27 51 22 55 23 58 18 58 18 52 15 49 17 42 25 37 26 31 19 33 13 27 0 27 7 23 3 20 10 15 13 21 20 20 21 15 17 17 14 19 15 23 12 25 5 35 3 36 0 42 1 38 5 41 5 43 2 46 4 53 0 49 8 52 10 50 11 55 22 60 22 59 29 52 28 45 32 41 38 42 43 40 45 43 48"/>
          </g>
          {/* 41: 佐賀県 */}
          <g className="ps-pref ps-pref--kyushu-okinawa" data-code="41" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(108.000000, 773.000000)">
            <title>佐賀 / Saga</title>
        <polygon points="15 6 28 6 34 12 41 10 40 16 32 21 30 28 25 23 19 29 22 39 14 36 8 29 9 25 2 23 0 16 2 13 5 17 4 13 6 9 2 6 3 4 6 6 6 0 7 2 11 2 12 7"/>
          </g>
          {/* 42: 長崎県 */}
          <g className="ps-pref ps-pref--kyushu-okinawa" data-code="42" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(44.000000, 700.000000)">
            <title>長崎 / Nagasaki</title>
        <path d="M53,1 L55,0 L57,2 L54,5 L55,9 L49,15 L48,19 L51,18 L49,22 L51,21 L48,25 L48,20 L46,22 L46,19 L45,22 L42,20 L44,20 L45,15 L47,15 L45,14 L49,10 L46,8 L48,3 L52,3 L53,1 Z M46,29 L43,35 L37,36 L40,22 L41,24 L45,25 L44,22 L45,26 L48,25 L46,29 Z M67,59 L68,61 L64,63 L60,59 L62,59 L61,56 L64,53 L67,55 L66,57 L68,58 L67,59 Z M28,110 L25,115 L26,110 L23,107 L26,106 L26,102 L28,102 L30,94 L28,105 L33,106 L30,108 L28,106 L28,110 Z M24,112 L21,111 L21,109 L23,111 L22,108 L24,112 Z M19,113 L20,110 L19,116 L16,111 L19,113 Z M6,118 L9,117 L10,119 L12,115 L16,125 L9,124 L9,129 L0,126 L1,124 L3,126 L4,125 L2,125 L5,122 L4,116 L6,118 Z M65,80 L62,81 L64,78 L65,80 Z M67,82 L70,84 L67,86 L67,82 Z M29,88 L31,85 L33,87 L29,88 Z M54,76 L51,77 L55,74 L54,76 Z M66,86 L64,89 L66,96 L73,98 L72,102 L78,109 L86,112 L79,117 L92,118 L94,123 L92,130 L82,134 L80,128 L85,124 L84,122 L79,121 L71,123 L68,129 L60,134 L64,129 L63,126 L65,127 L67,123 L64,125 L63,118 L59,117 L56,111 L59,100 L63,104 L62,108 L63,106 L66,108 L64,115 L75,118 L71,112 L72,107 L69,103 L66,105 L65,99 L62,99 L62,97 L58,100 L60,98 L57,96 L57,93 L57,95 L53,93 L57,87 L54,86 L55,83 L60,82 L60,85 L65,84 L66,86 Z M49,88 L48,92 L42,94 L47,91 L45,89 L48,84 L52,84 L54,81 L55,84 L49,88 Z M15,115 L15,113 L18,116 L15,118 L15,115 Z M64,101 L63,104 L62,101 L64,98 L64,101 Z"/>
          </g>
          {/* 43: 熊本県 */}
          <g className="ps-pref ps-pref--kyushu-okinawa" data-code="43" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(115.000000, 800.000000)">
            <title>熊本 / kumamoto</title>
        <path d="M8,37 L13,38 L13,48 L5,57 L1,58 L1,52 L5,51 L0,50 L4,40 L3,37 L8,37 Z M20,47 L14,47 L12,43 L19,39 L26,39 L23,47 L20,47 Z M24,34 L26,34 L26,38 L23,38 L24,34 Z M38,67 L33,61 L24,65 L19,61 L32,46 L30,40 L32,41 L31,39 L37,34 L26,34 L34,28 L35,23 L27,15 L26,10 L31,10 L30,7 L35,3 L39,4 L40,0 L48,5 L56,10 L58,7 L57,1 L63,1 L70,14 L69,20 L73,24 L69,24 L60,38 L55,40 L55,47 L60,54 L56,59 L59,65 L38,67 Z"/>
          </g>
          {/* 44: 大分県 */}
          <g className="ps-pref ps-pref--kyushu-okinawa" data-code="44" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(163.000000, 771.000000)">
            <title>大分 / Oita</title>
        <polygon points="0 34 3 29 0 26 2 24 1 19 5 13 12 9 19 10 20 3 33 7 38 0 47 4 49 10 46 18 43 17 43 20 35 22 36 26 40 28 56 27 50 36 56 36 53 38 56 40 61 38 62 41 57 41 55 45 65 49 59 49 61 51 57 54 60 55 54 56 54 60 52 60 52 55 48 54 45 58 37 58 32 53 27 54 25 53 21 49 22 43 15 30 9 30 10 36 8 39"/>
          </g>
          {/* 45: 宮崎県 */}
          <g className="ps-pref ps-pref--kyushu-okinawa" data-code="45" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(152.000000, 824.000000)">
            <title>宮崎 / Miyazaki</title>
        <polygon points="36 0 38 1 43 0 48 5 56 5 59 1 63 2 63 7 65 7 54 17 53 21 56 22 52 23 51 25 53 26 47 34 41 51 39 74 34 79 32 91 27 89 22 84 24 81 24 74 17 73 14 64 9 62 10 57 5 52 0 45 1 43 22 41 19 35 23 30 18 23 18 16 23 14 32 0"/>
          </g>
          {/* 46: 鹿児島県 */}
          <g className="ps-pref ps-pref--kyushu-okinawa" data-code="46" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(96.000000, 17.000000)">
            <title>鹿児島 / Kagoshima</title>
        <polygon points="23 949 26 951 23 952"/>
        <polygon points="33 960 32 954 39 950 48 956 47 961 41 965 35 964"/>
        <polygon points="64 953 64 958 59 959 58 952 62 949 63 939 70 929 71 938"/>
        <polygon points="38 844 43 848 52 844 57 850 56 852 61 859 66 864 65 869 70 871 73 880 80 881 80 888 78 891 75 890 70 896 75 899 73 903 76 902 69 905 66 910 50 918 50 913 55 910 59 898 53 889 54 884 48 881 53 879 54 883 57 884 61 878 54 872 50 874 44 887 46 898 51 901 49 906 43 907 40 901 27 901 28 897 25 896 27 894 22 890 31 890 35 880 32 871 27 867 30 860 28 848 31 846 35 848"/>
        <polygon points="31 837 34 836 33 838"/>
        <polygon points="27 848 24 842 29 840 30 844"/>
        <polygon points="4 868 6 865 7 867 2 875 0 874"/>
        <polygon points="12 864 9 861 14 861"/>
          </g>
          {/* 47: 沖縄県 */}
          <g className="ps-pref ps-pref--kyushu-okinawa" data-code="47" strokeLinejoin="round" fill="#EEEEEE" fillRule="nonzero" stroke="#000000" strokeWidth="1.0" transform="translate(-25.222666, 962.506956) scale(0.350000)">
            <title>沖縄 / Okinawa</title>
        <polygon points="4 109 6 110 4 111 0 110"/>
        <polygon points="48 121 55 123 51 129 39 124 42 122 44 125 46 118"/>
        <polygon points="132 113 130 110 132 110 130 108 133 105 132 100 135 108 142 114"/>
        <polygon points="225 23 224 28 219 23 223 21"/>
        <polygon points="73 117 77 112 79 113 73 120 72 126 66 127 64 125 67 122 63 119 71 120"/>
        <polygon points="287 20 291 17 286 15 285 8 292 10 292 14 299 13 298 11 307 0 309 5 309 9 305 15 300 15 299 19 293 19 294 21 288 25 281 25 286 34 281 31 276 39 280 41 270 46 270 38 277 32 275 24 280 25"/>
        <polygon points="127 106 126 103 128 104"/>
        <polygon points="279 8 279 6 283 8"/>
        <polygon points="293 11 294 13 292 12"/>
          </g>
        </a>
            </g>
            <g className="boundary-line" stroke="#EEEEEE" strokeWidth="12" strokeLinejoin="round">
              <line x1="320.227" y1="361.996" x2="582.351" y2="109.378" />
              <line x1="277.337" y1="380.162" x2="46.213" y2="380.162" />
            </g>
          </g>
        </g>
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
                {region} <span aria-hidden="true">→</span>
              </span>
              <span className="ps-region-label__prefs">{prefs.join("　")}</span>
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
