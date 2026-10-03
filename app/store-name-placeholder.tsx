export function StoreNamePlaceholder({ name }: { name: string }) {
  const match = name.match(/^(.+?)[（(](.+)[）)]$/);
  const main = match ? match[1].trim() : name;
  const detail = match ? `（${match[2]}）` : null;
  const length = [...main].reduce((n, c) => n + (/[\x00-\x7f]/.test(c) ? 0.55 : 1), 0);
  return <div className={`auto-store-name ${length > 18 ? "auto-store-name-long" : length > 12 ? "auto-store-name-medium" : ""}`}>
    <div className="auto-store-name-inner"><strong>{main}</strong>{detail && <span className="auto-store-name-detail">{detail}</span>}<small>POKER SUMMIT</small></div>
  </div>;
}
export function StoreFallbackLogo() { return <img className="store-fallback-finger" src="/images/summit-finger.svg" alt="Poker Summit" />; }

export function StoreDisplayName({ name }: { name: string }) {
 const match = name.match(/^(.+?)[（(](.+)[）)]$/);
 return <>{match ? <>{match[1].trim()}<span className="store-display-name-detail">（{match[2]}）</span></> : name}</>;
}
