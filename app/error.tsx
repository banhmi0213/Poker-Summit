"use client";

import Link from "next/link";
import { useEffect } from "react";

// 予期しないエラーが起きたときの画面(2026/10)。英語の既定画面の代わりに、やり直し・TOPへの導線を出す
export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="container" style={{ padding: "56px 16px 64px", textAlign: "center", maxWidth: 560 }}>
      <p style={{ fontSize: 13, letterSpacing: ".2em", color: "#8c6428", margin: 0 }}>ERROR</p>
      <h1 style={{ fontSize: 22, margin: "10px 0 14px" }}>うまく表示できませんでした</h1>
      <p style={{ fontSize: 15, lineHeight: 1.8, color: "#514536", margin: "0 0 26px" }}>
        通信状況などにより、ページを表示できませんでした。
        <br />
        少し時間をおいて、もう一度お試しください。
      </p>
      <div style={{ display: "grid", gap: 10, maxWidth: 320, margin: "0 auto" }}>
        <button type="button" onClick={() => reset()} className="btn primary" style={{ justifyContent: "center", minHeight: 48, fontSize: 15 }}>もう一度読み込む</button>
        <Link href="/" className="btn" style={{ justifyContent: "center", minHeight: 46, fontSize: 15 }}>TOPへ戻る</Link>
      </div>
      {error.digest && <p style={{ marginTop: 22, fontSize: 12, color: "#8b7c68" }}>エラー番号：{error.digest}</p>}
    </main>
  );
}
