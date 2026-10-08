import type { CSSProperties } from "react";
import { nameWidth, nameTitleLines } from "@/lib/name-layout";
import { ReadableName } from "@/app/readable-name";
export function StoreNamePlaceholder({ name }: { name: string }) {
 const match = name.match(/^(.+?)[（(](.+)[）)]$/);
 const main = match ? match[1].trim() : name;
 const detail = match ? `（${match[2]}）` : null;
 const lines = nameTitleLines(main);
 const width = Math.max(...lines.map(nameWidth), 1);
 const titleStyle: CSSProperties = { fontSize: `min(23px, ${88 / width}cqi)`, lineHeight: 1.35, wordBreak: "normal", overflowWrap: "normal" };
 return <div className="auto-store-name"><div className="auto-store-name-inner" style={{ containerType: "inline-size" }}>
  <strong style={titleStyle}>{lines.map((line,i) => <span key={i} style={{ display: "block", whiteSpace: "nowrap" }}>{line}</span>)}</strong>
  {detail && <span className="auto-store-name-detail"><ReadableName name={detail} /></span>}<small>POKER SUMMIT</small>
 </div></div>;
}
export function StoreFallbackLogo() { return <img className="store-fallback-finger" src="/images/summit-finger-clean.png" alt="Poker Summit" />; }

export function StoreDisplayName({ name }: { name: string }) {
 const match = name.match(/^(.+?)[（(](.+)[）)]$/);
 return <>{match ? <><ReadableName name={match[1].trim()} /><span className="store-display-name-detail"><ReadableName name={`（${match[2]}）`} /></span></> : <ReadableName name={name} />}</>;
}
