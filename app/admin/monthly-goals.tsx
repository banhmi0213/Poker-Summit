// 今月の目標と進み具合(2026/10/22 オーナー指示)。近づいているか遠いかが一目でわかるように、
// 「今日までに届いていてほしい数」と比べて、順調・少し遅れ・遅れを出す。
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { saveMonthlyGoals } from "./monthly-goals-actions";

type Goals = { pv: number; uu: number; members: number; dealers: number; paid_stores: number };
const DEFAULT_GOALS: Goals = { pv: 20000, uu: 5000, members: 300, dealers: 30, paid_stores: 5 };
// サイトの一般公開は 2026/10/21。公開した月は、公開日から月末までで進み具合を見る
const LAUNCH = Date.parse("2026-10-21T00:00:00+09:00");

const ITEMS: { key: keyof Goals; label: string; unit: string; pace: boolean; note: string }[] = [
  { key: "pv", label: "サイト全体PV", unit: "PV", pace: true, note: "今月" },
  { key: "uu", label: "来た人数（UU）", unit: "人", pace: true, note: "今月" },
  { key: "members", label: "会員登録", unit: "人", pace: true, note: "今月の新規" },
  { key: "dealers", label: "フリーディーラー", unit: "人", pace: false, note: "公開中の合計" },
  { key: "paid_stores", label: "有料契約の店舗", unit: "店", pace: false, note: "契約中の合計" },
];

export async function MonthlyGoals() {
  const supabase = await createClient();
  const [{ data: progress, error }, { data: settings }] = await Promise.all([
    supabase.rpc("admin_month_progress"),
    createServiceRoleClient().from("site_settings").select("monthly_goals").eq("id", true).maybeSingle(),
  ]);
  if (error || !progress) return null;
  const p = progress as Record<string, number | string>;
  const goals: Goals = { ...DEFAULT_GOALS, ...((settings?.monthly_goals as Partial<Goals> | null) ?? {}) };

  const monthStart = Date.parse(String(p.month_start));
  const now = Date.now();
  const jstNow = new Date(now + 9 * 3600000);
  const monthEnd = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth() + 1, 1) - 9 * 3600000;
  const from = Math.max(monthStart, LAUNCH);
  const elapsed = Math.min(1, Math.max(0.0001, (now - from) / (monthEnd - from)));
  // 公開した月は、月の目標を公開日からの日数分に割って比べる(例: 10月は10/21〜31の11日分)
  const share = (monthEnd - from) / (monthEnd - monthStart);
  const daysLeft = Math.max(0, Math.ceil((monthEnd - now) / 86400000));
  const monthLabel = `${jstNow.getUTCMonth() + 1}月`;

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>{monthLabel}の目標と進み具合</h2>
        <span className="muted" style={{ fontSize: 12 }}>
          残り{daysLeft}日{from > monthStart ? "（今月は10/21の公開日から月末までの日数分に目標を割って計算）" : ""}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 12 }}>
        {ITEMS.map((it) => {
          const actual = Number(p[it.key] ?? 0);
          const goal = Math.round((goals[it.key] || 0) * (it.pace ? share : 1));
          const rate = goal > 0 ? actual / goal : 0;
          const expected = it.pace ? goal * elapsed : goal;
          const paceRate = expected > 0 ? actual / expected : 0;
          const forecast = it.pace ? Math.round(actual / elapsed) : actual;
          const status = goal <= 0 ? null : rate >= 1 ? { t: "達成", c: "#1f7a3d" } : !it.pace ? null : paceRate >= 1 ? { t: "順調", c: "#1f7a3d" } : paceRate >= 0.7 ? { t: "少し遅れ", c: "#a8770c" } : { t: "遅れ", c: "#b3261e" };
          return (
            <div key={it.key} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                <span className="muted" style={{ fontSize: 12.5 }}>{it.label}</span>
                {status && <span style={{ fontSize: 12, fontWeight: 800, color: status.c }}>{status.t}</span>}
              </div>
              <div className="tabular" style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>
                {actual.toLocaleString()}
                <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}> / {goal.toLocaleString()}{it.unit}</span>
              </div>
              <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 4, marginTop: 6, overflow: "hidden", position: "relative" }}>
                <div style={{ width: `${Math.min(100, rate * 100)}%`, height: "100%", background: status?.c ?? "#c7a132" }} />
                {it.pace && <div title="今日までに届いていてほしい位置" style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(100, elapsed * 100)}%`, width: 2, background: "#392c1c" }} />}
              </div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.6 }}>
                {it.note}・達成率 {Math.round(rate * 100)}%
                {it.pace && <><br />今日までの目安 {Math.round(expected).toLocaleString()}{it.unit}・このペースなら月末 {forecast.toLocaleString()}{it.unit}</>}
                {!it.pace && goal > actual && <><br />あと{(goal - actual).toLocaleString()}{it.unit}</>}
              </div>
            </div>
          );
        })}
      </div>
      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontSize: 13 }}>目標を変える</summary>
        <form action={saveMonthlyGoals} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 8 }}>
          {ITEMS.map((it) => (
            <label key={it.key} style={{ fontSize: 12.5 }}>
              {it.label}（{it.unit}）
              <input type="number" name={it.key} min={0} defaultValue={goals[it.key]} style={{ display: "block", width: 120, marginTop: 4 }} />
            </label>
          ))}
          <button type="submit" className="btn">目標を保存する</button>
        </form>
      </details>
    </section>
  );
}
