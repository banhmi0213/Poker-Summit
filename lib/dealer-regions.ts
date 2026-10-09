import { PREF_OPTIONS, PREF_REGION, REGIONS } from "./constants";

export const DEALER_REGION_GROUPS = REGIONS.map(name => ({ name, prefs: PREF_OPTIONS.filter(p => PREF_REGION[p]?.includes(name)) }));
export const DEALER_REGION_ALIASES: Record<string, string[]> = {
 ...Object.fromEntries(PREF_OPTIONS.flatMap(p => [[p, [p]], [p.replace(/[都府県]$/, ""), [p]]])),
 ...Object.fromEntries(DEALER_REGION_GROUPS.map(r => [r.name, r.prefs])),
 関西: DEALER_REGION_GROUPS.find(r => r.name === "近畿")!.prefs,
 全国: PREF_OPTIONS,
 東北: DEALER_REGION_GROUPS[0].prefs.filter(p => p !== "北海道"),
 九州: DEALER_REGION_GROUPS[6].prefs.filter(p => p !== "沖縄県"),
};

// Only migrate unambiguous lists. Never infer coverage from a home address or
// prose such as "大阪府以外" / "関東（東京都を除く）".
export function inferDealerPrefectures(text: string): string[] {
 const tokens = text.trim().split(/[・、,，/／;；\s]+/).filter(Boolean);
 if (!tokens.length || tokens.some(t => !Object.hasOwn(DEALER_REGION_ALIASES, t))) return [];
 const selected = new Set(tokens.flatMap(t => DEALER_REGION_ALIASES[t]));
 return PREF_OPTIONS.filter(p => selected.has(p));
}

export function validDealerPrefectures(prefs: string[], required: boolean): boolean {
 return prefs.length <= 47 && (!required || prefs.length > 0) && prefs.every(p => PREF_OPTIONS.includes(p));
}
