"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { runGoogleMatchBatch } from "./actions";

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
