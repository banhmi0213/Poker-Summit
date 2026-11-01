"use client";

import Link from "next/link";
import { useState } from "react";
import { sweepImportArea } from "./sweep-actions";
import { SWEEP_AREAS, SWEEP_DONE } from "./sweep-areas";

/** 都道府県を地域ごとに順番に検索して、取りこぼしを拾う一括検索 */
export function SweepRunner() {
  const prefs = Object.keys(SWEEP_AREAS);
  const [selected, setSelected] = useState<string[]>(prefs.filter((p) => !SWEEP_DONE.includes(p)));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; found: number; inserted: number; current: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const tasks = selected.flatMap((pref) => SWEEP_AREAS[pref].map((area) => ({ pref, area })));
    setRunning(true);
    setError(null);
    let found = 0;
    let inserted = 0;
    try {
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        setProgress({ done: i, total: tasks.length, found, inserted, current: `${t.pref} ${t.area}` });
        const r = await sweepImportArea(t.pref, t.area);
        found += r.found;
        inserted += r.inserted;
      }
      setProgress({ done: tasks.length, total: tasks.length, found, inserted, current: "完了" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, marginBottom: 6 }}>地域を細かく区切って一括検索(取りこぼし拾い)</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        駅・繁華街・市ごとに「ポーカー」「アミューズメントカジノ」「ポーカーバー」で順番に検索し、まだ登録のない店を「承認待ち」で仮登録します。
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <button type="button" className="btn" disabled={running} onClick={() => setSelected(prefs)}>すべて選ぶ</button>
        <button type="button" className="btn" disabled={running} onClick={() => setSelected([])}>すべて外す</button>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10, fontSize: 13 }}>
        {prefs.map((p) => (
          <label key={p} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={selected.includes(p)}
              disabled={running}
              onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p] : s.filter((x) => x !== p)))}
            />
            {p}({SWEEP_AREAS[p].length}){SWEEP_DONE.includes(p) ? "✓済" : ""}
          </label>
        ))}
      </div>
      <button className="btn primary" onClick={run} disabled={running || selected.length === 0}>
        {running ? "検索中…(このままお待ちください)" : "一括検索を開始"}
      </button>
      {progress && (
        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          {progress.done}/{progress.total}地域({progress.current}) ・ 見つかった {progress.found}件 ・ 新しく仮登録 <strong>{progress.inserted}件</strong>
          {progress.current === "完了" && (
            <>
              {" "}<Link href="/admin/stores?status=pending">承認待ちを見る</Link>
            </>
          )}
        </p>
      )}
      {error && <p className="err" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
