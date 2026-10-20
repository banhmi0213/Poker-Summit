"use client";

import { useEffect, useState } from "react";

// ヘッダーの「お知らせ」に、まだ見ていない運営のお知らせがあるときだけ赤い点を出す(2026/10/20)。
// 見たかどうかはその端末(localStorage)で覚える。お知らせページを開くと消える。
const KEY = "ps_news_seen";
let latestPromise: Promise<string | null> | null = null;

function fetchLatest() {
  if (!latestPromise) {
    latestPromise = fetch("/api/site-notices/latest")
      .then((r) => (r.ok ? r.json() : { latest: null }))
      .then((j) => (j?.latest as string | null) ?? null)
      .catch(() => null);
  }
  return latestPromise;
}

function readSeen() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function NewsDot({ className }: { className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (window.location.pathname === "/news") return;
    let alive = true;
    fetchLatest().then((latest) => {
      if (!alive || !latest) return;
      const seen = readSeen();
      if (!seen || Date.parse(seen) < Date.parse(latest)) setShow(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!show) return null;
  return <span className={`news-dot ${className ?? ""}`} role="img" aria-label="新しいお知らせがあります" />;
}

/** お知らせページで呼ぶ: いちばん新しいお知らせを「見た」ことにする */
export function MarkNewsSeen({ latest }: { latest: string | null }) {
  useEffect(() => {
    if (!latest) return;
    try {
      const seen = localStorage.getItem(KEY);
      if (!seen || Date.parse(seen) < Date.parse(latest)) localStorage.setItem(KEY, latest);
    } catch {
      // 保存できない環境では何もしない
    }
  }, [latest]);
  return null;
}
