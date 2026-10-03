import type { CSSProperties } from "react";
const nameWidth = (text: string) => [...text].reduce((n, c) => n + (/[\x00-\x7f]/.test(c) ? 0.55 : 1), 0);
function bannerLines(name: string): string[] {
 if (nameWidth(name) <= 12) return [name];
 const boundaries = [...name.matchAll(/\s+|(?=トーナメント|ポーカー|POKER|Poker|アミューズメント|カジノ)/g)].map(m => m.index!).filter(i => i > 0 && i < name.length);
 if (!boundaries.length) return [name];
 const split = boundaries.reduce((best, i) => Math.max(nameWidth(name.slice(0,i)), nameWidth(name.slice(i))) < Math.max(nameWidth(name.slice(0,best)),nameWidth(name.slice(best))) ? i : best, boundaries[0]);
 return [name.slice(0,split).trim(), name.slice(split).trim()];
}
export function StoreNamePlaceholder({ name }: { name: string }) {
 const match = name.match(/^(.+?)[（(](.+)[）)]$/);
 const main = match ? match[1].trim() : name;
 const detail = match ? `（${match[2]}）` : null;
 const lines = bannerLines(main);
 const width = Math.max(...lines.map(nameWidth), 1);
 const titleStyle: CSSProperties = { fontSize: `min(23px, ${88 / width}cqi)`, lineHeight: 1.35, wordBreak: "normal", overflowWrap: "normal" };
 return <div className="auto-store-name"><div className="auto-store-name-inner" style={{ containerType: "inline-size" }}>
  <strong style={titleStyle}>{lines.map((line,i) => <span key={i} style={{ display: "block", whiteSpace: "nowrap" }}>{line}</span>)}</strong>
  {detail && <span className="auto-store-name-detail">{detail}</span>}<small>POKER SUMMIT</small>
 </div></div>;
}
export function StoreFallbackLogo() { return <img className="store-fallback-finger" src="/images/summit-finger-clean.png" alt="Poker Summit" />; }

export function StoreDisplayName({ name }: { name: string }) {
 const match = name.match(/^(.+?)[（(](.+)[）)]$/);
 return <>{match ? <>{match[1].trim()}<span className="store-display-name-detail">（{match[2]}）</span></> : name}</>;
}
