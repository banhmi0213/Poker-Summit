import { createClient } from "@/lib/supabase/server";
import { SCRAPE_CATEGORY_LABEL, type ScrapeCategory } from "@/lib/scrape-watch";

// スクレイピング監視(2026/10/30)。自動収集の疑いがあるアクセスの記録。遮断はしていない(記録して運営にメールで知らせるだけ)。
export const dynamic = "force-dynamic";
type Hit = { id: number; created_at: string; ip: string | null; ua: string | null; path: string | null; category: ScrapeCategory; bot: string | null };
const fmt = (iso: string) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default async function ScrapeWatchPage({ searchParams }: { searchParams: { days?: string } }) {
  const supabase = await createClient();
  const days = [1, 7, 30].includes(Number(searchParams.days)) ? Number(searchParams.days) : 1;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase.from("scrape_hits").select("id, created_at, ip, ua, path, category, bot").gte("created_at", since).order("created_at", { ascending: false }).limit(2000);
  const hits = (data ?? []) as Hit[];
  const group = (key: (h: Hit) => string) => {
    const m = new Map<string, { n: number; last: string; sample: Hit }>();
    for (const h of hits) { const k = key(h), g = m.get(k); if (g) g.n++; else m.set(k, { n: 1, last: h.created_at, sample: h }); }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 30);
  };
  const byBot = group((h) => `${h.category}|${h.bot ?? ""}`), byIp = group((h) => h.ip ?? "(不明)");
  return (
    <div className="container">
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>スクレイピング監視</h1>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 12 }}>
        サイトの情報を自動で集めている疑いのあるアクセスの記録です（AIの収集ロボット、プログラム・ツール、自動操作のブラウザなど）。遮断はしていません。
        見つけたときは「通知先メールアドレス」にメールで知らせます（同じ相手は1時間に1回まで。ブラウザらしくないアクセスは同じIPから10分で30ページ以上のとき）。記録は90日で消えます。
      </p>
      <p style={{ marginBottom: 12, fontSize: 13 }}>{[1, 7, 30].map((d) => <a key={d} href={`?days=${d}`} style={{ marginRight: 12, fontWeight: d === days ? 700 : 400 }}>{d === 1 ? "24時間" : `${d}日`}</a>)}{hits.length.toLocaleString()}件{hits.length >= 2000 ? "（最新2000件まで）" : ""}</p>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", marginBottom: 16 }}>
        <section className="card"><h2 style={{ fontSize: 15, marginBottom: 8 }}>相手ごと</h2>
          {byBot.length ? byBot.map(([k, g]) => <p key={k} style={{ fontSize: 13, lineHeight: 1.7 }}><span className="badge outline" style={{ marginRight: 6 }}>{SCRAPE_CATEGORY_LABEL[g.sample.category] ?? g.sample.category}</span><strong>{g.sample.bot || "不明"}</strong> {g.n}回 · 最後 {fmt(g.last)}</p>) : <p className="muted" style={{ fontSize: 13 }}>ありません</p>}
        </section>
        <section className="card"><h2 style={{ fontSize: 15, marginBottom: 8 }}>IPアドレスごと</h2>
          {byIp.length ? byIp.map(([k, g]) => <p key={k} style={{ fontSize: 13, lineHeight: 1.7 }}><strong>{k}</strong> {g.n}回 · {g.sample.bot || "不明"} · 最後 {fmt(g.last)}</p>) : <p className="muted" style={{ fontSize: 13 }}>ありません</p>}
        </section>
      </div>
      <section className="card"><h2 style={{ fontSize: 15, marginBottom: 8 }}>最新の記録</h2>
        <div style={{ overflowX: "auto" }}><table className="table" style={{ fontSize: 12.5 }}><thead><tr><th>日時</th><th>種類</th><th>名前</th><th>IP</th><th>ページ</th><th>ユーザーエージェント</th></tr></thead>
          <tbody>{hits.slice(0, 200).map((h) => <tr key={h.id}><td style={{ whiteSpace: "nowrap" }}>{fmt(h.created_at)}</td><td>{SCRAPE_CATEGORY_LABEL[h.category] ?? h.category}</td><td>{h.bot}</td><td>{h.ip}</td><td style={{ maxWidth: 220, wordBreak: "break-all" }}>{h.path}</td><td style={{ maxWidth: 320, wordBreak: "break-all" }}>{h.ua}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
