"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { runGoogleHoursBatch, runGoogleMatchBatch, runRegeocodeBatch } from "./actions";

const LABEL: Record<string, string> = {
  matched: "結びつけ",
  ambiguous: "要確認",
  not_found: "見つからない",
  duplicate: "重複の可能性",
  error: "エラー",
};

export function GoogleMatchRunner({ remaining: initialRemaining }: { remaining: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    let left = remaining;
    try {
      while (left > 0) {
        const r = await runGoogleMatchBatch();
        left = r.remaining;
        setRemaining(r.remaining);
        setTotals((t) => {
          const next = { ...t };
          for (const [k, v] of Object.entries(r.counts)) next[k] = (next[k] ?? 0) + v;
          return next;
        });
        if (r.processed === 0) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p style={{ marginBottom: 8 }}>
        未確認の店舗: <strong>{remaining}件</strong>
      </p>
      <button className="btn primary" onClick={run} disabled={running || remaining === 0}>
        {running ? "照合中…(このままお待ちください)" : remaining === 0 ? "照合済み" : "Googleマップと照合を開始"}
      </button>
      {Object.keys(totals).length > 0 && (
        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          今回の結果: {Object.entries(totals).map(([k, v]) => `${LABEL[k] ?? k} ${v}件`).join(" / ")}
        </p>
      )}
      {error && <p className="err" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

/** 座標(地図のピン・現在地からの距離に使う)を国土地理院の住所検索で取り直す */
export function RegeocodeRunner({ remaining: initialRemaining }: { remaining: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [done, setDone] = useState({ ok: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    let left = remaining;
    try {
      while (left > 0) {
        const r = await runRegeocodeBatch();
        left = r.remaining;
        setRemaining(r.remaining);
        setDone((d) => ({ ok: d.ok + r.ok, failed: d.failed + r.failed }));
        if (r.processed === 0) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  if (initialRemaining === 0 && done.ok + done.failed === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p style={{ marginBottom: 4 }}>
        座標を取り直していない店舗: <strong>{remaining}件</strong>
      </p>
      <p className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
        Googleマップの座標は利用規約上ずっとは保存できないため、国土地理院の住所検索で取り直します(無料)。
      </p>
      <button className="btn primary" onClick={run} disabled={running || remaining === 0}>
        {running ? "取り直し中…(このままお待ちください)" : remaining === 0 ? "完了" : "座標を取り直す"}
      </button>
      {done.ok + done.failed > 0 && (
        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          今回の結果: 取得 {done.ok}件 / 取得できず {done.failed}件
        </p>
      )}
      {error && <p className="err" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

/** 営業時間が空の店舗の営業時間を、Googleマップから取る(月850回まで=無料枠の範囲) */
export function GoogleHoursRunner({ remaining: initialRemaining, withHours }: { remaining: number; withHours: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [done, setDone] = useState({ fetched: 0, found: 0 });
  const [capReached, setCapReached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    let left = remaining;
    try {
      while (left > 0) {
        const r = await runGoogleHoursBatch();
        left = r.remaining;
        setRemaining(r.remaining);
        setDone((d) => ({ fetched: d.fetched + r.fetched, found: d.found + r.found }));
        if (r.capReached) {
          setCapReached(true);
          break;
        }
        if (r.fetched === 0) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p style={{ marginBottom: 4 }}>
        Googleの営業時間を表示中: <strong>{withHours}店</strong> / まだ取っていない(または取り直しが必要な)店舗: <strong>{remaining}件</strong>
      </p>
      <p className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
        店舗が自分で営業時間を入れた店は取りません。毎晩の自動見直しでも少しずつ取り直します(Googleの無料枠内で月850回まで)。
      </p>
      <button className="btn primary" onClick={run} disabled={running || remaining === 0}>
        {running ? "取得中…(このままお待ちください)" : remaining === 0 ? "完了" : "Googleから営業時間を取る"}
      </button>
      {done.fetched > 0 && (
        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          今回の結果: {done.fetched}件を確認 / 営業時間あり {done.found}件
        </p>
      )}
      {capReached && <p className="err" style={{ marginTop: 8 }}>今月の上限(850回)に達したので止めました。続きは来月、自動で取ります。</p>}
      {error && <p className="err" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
