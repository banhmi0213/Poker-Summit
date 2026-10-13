"use client";

import { useState } from "react";
import styles from "./poker-table.module.css";

type Action = "FOLD" | "CHECK" | "CALL" | "RAISE";
const seats = [
  { name: "PLAYER 2", stack: "2,500" },
  { name: "PLAYER 3", stack: "1,850" },
  { name: "PLAYER 4", stack: "3,100" },
  { name: "PLAYER 5", stack: "2,260" },
  { name: "PLAYER 6", stack: "1,900" },
];

export default function PokerTablePreview() {
  const [action, setAction] = useState<Action | null>(null);
  const [raise, setRaise] = useState(100);
  return <section className={styles.shell} aria-label="ポーカーテーブルのデザイン試作">
    <div className={styles.heading}><span>POKER SUMMIT · TEXAS HOLD'EM</span><strong>UI PREVIEW</strong></div>
    <h1>オンラインポーカー テーブル試作</h1>
    <p className={styles.notice}>これは画面・操作感を確認するためのデモです。実際の対戦、チップ増減、カード抽選、サーバー通信は行いません。</p>
    <div className={styles.table}>
      <div className={styles.topSeats}>{seats.slice(0, 3).map((s, i) => <Seat key={s.name} {...s} index={i + 2} />)}</div>
      <div className={styles.felt}>
        <div className={styles.pot}>POT <strong>1,575</strong></div>
        <div className={styles.cards} aria-label="サンプル共通カード">{["6♦", "2♥", "10♣", "9♣", "—"].map((c, i) => <span key={i} className={c.includes("♥") || c.includes("♦") ? styles.red : ""}>{c}</span>)}</div>
        <div className={styles.street}>TURN · デモ表示</div>
      </div>
      <div className={styles.bottomSeats}>{seats.slice(3).map((s, i) => <Seat key={s.name} {...s} index={i + 5} />)}</div>
      <div className={styles.self}><div className={styles.avatar}>YOU</div><div><strong>あなた</strong><small>2,500 chips</small></div><div className={styles.hole}><span>A♠</span><span>Q♥</span></div></div>
    </div>
    <div className={styles.controls}>
      <div className={styles.turn}>あなたの番（サンプル）</div>
      <label htmlFor="poker-demo-raise">レイズ額: {raise.toLocaleString()} chips</label>
      <input id="poker-demo-raise" type="range" min={100} max={1000} step={50} value={raise} onChange={e => setRaise(Number(e.target.value))} />
      <div className={styles.actions}>
        <button type="button" onClick={() => setAction("FOLD")}>フォールド</button>
        <button type="button" onClick={() => setAction("CHECK")}>チェック</button>
        <button type="button" onClick={() => setAction("CALL")}>コール</button>
        <button type="button" onClick={() => setAction("RAISE")}>レイズ</button>
      </div>
      <p role="status" aria-live="polite">{action ? `選択: ${action === "RAISE" ? `レイズ ${raise.toLocaleString()} chips` : action}（デモのため送信されません）` : "操作ボタンを押すと選択状態を確認できます。"}</p>
      <button className={styles.reset} type="button" onClick={() => { setAction(null); setRaise(100); }}>デモをリセット</button>
    </div>
  </section>;
}

function Seat({ name, stack, index }: { name: string; stack: string; index: number }) {
  return <div className={styles.seat}><div className={styles.avatar}>{index}</div><span>{name}</span><small>{stack}</small></div>;
}
