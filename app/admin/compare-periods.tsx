// 前日・先週・先月・前年と比べた上げ下げ(2026/10/22 オーナー指示)。
// 「今の期間の始まり〜今」と「前の期間の同じ経過時間まで」を比べる(例: 今日0時〜今 と 昨日0時〜昨日の同じ時刻)。
import { createClient } from "@/lib/supabase/server";

type Cell = { cur: number; prev: number; ok: boolean };
const PERIODS: { key: string; label: string; cur: string }[] = [
  { key: "day", label: "前日比", cur: "今日" },
  { key: "week", label: "先週比", cur: "今週" },
  { key: "month", label: "先月比", cur: "今月" },
  { key: "year", label: "前年比", cur: "今年" },
];
const METRICS: { key: string; label: string; unit: string }[] = [
  { key: "site_pv", label: "サイト全体PV", unit: "PV" },
  { key: "site_uu", label: "サイト全体UU", unit: "人" },
  { key: "store_pv", label: "店舗ページPV", unit: "PV" },
  { key: "store_uu", label: "店舗ページUU", unit: "人" },
  { key: "members", label: "会員登録（新規）", unit: "人" },
];

function Change({ c, unit }: { c?: Cell; unit: string }) {
  if (!c) return <span className="muted">-</span>;
  const cur = Number(c.cur) || 0, prev = Number(c.prev) || 0;
  if (!c.ok) {
    return (
      <>
        <div className="tabular" style={{ fontWeight: 800 }}>{cur.toLocaleString()}{unit}</div>
        <div className="muted" style={{ fontSize: 11.5 }}>比べる記録なし</div>
      </>
    );
  }
  const diff = cur - prev;
  const pct = prev > 0 ? Math.round((diff / prev) * 1000) / 10 : null;
  const color = diff > 0 ? "#1f7a3d" : diff < 0 ? "#b3261e" : "var(--muted)";
  const mark = diff > 0 ? "▲" : diff < 0 ? "▼" : "±";
  return (
    <>
      <div className="tabular" style={{ fontWeight: 800 }}>{cur.toLocaleString()}{unit}</div>
      <div className="tabular" style={{ fontSize: 12, color, fontWeight: 700 }}>
        {mark}{diff > 0 ? "+" : ""}{diff.toLocaleString()}{unit}
        {pct !== null ? `（${pct > 0 ? "+" : ""}${pct}%）` : prev === 0 && cur > 0 ? "（前は0）" : ""}
      </div>
      <div className="muted" style={{ fontSize: 11 }}>前 {prev.toLocaleString()}{unit}</div>
    </>
  );
}

export async function ComparePeriods() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_compare_periods");
  if (error || !data) return null;
  const d = data as Record<string, Record<string, Cell>>;
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12.5, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid var(--border)", verticalAlign: "top" };
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>前と比べた上げ下げ</h2>
        <span className="muted" style={{ fontSize: 12 }}>今日0時〜今と、昨日の同じ時刻までを比べる形（週・月・年も同じ）。PV・UUの記録は10/21から</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}></th>
              {PERIODS.map((p) => <th key={p.key} style={th}>{p.label}<span className="muted" style={{ fontWeight: 400 }}>（{p.cur}）</span></th>)}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.key}>
                <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>{m.label}</td>
                {PERIODS.map((p) => <td key={p.key} style={td}><Change c={d[p.key]?.[m.key]} unit={m.unit} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
