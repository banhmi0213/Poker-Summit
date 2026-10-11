"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { runGoogleMatchBatch, runRegeocodeBatch } from "./actions";

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
