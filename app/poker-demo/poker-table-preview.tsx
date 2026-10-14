"use client";

import { useEffect, useState } from "react";
import styles from "./poker-table.module.css";

type Action = "FOLD" | "CHECK" | "CALL" | "RAISE";
const seats = [
  { name: "PLAYER 2", stack: "2,500" },
  { name: "PLAYER 3", stack: "1,850" },
  { name: "PLAYER 4", stack: "3,100" },
  { name: "PLAYER 5", stack: "2,260" },
  { name: "PLAYER 6", stack: "1,900" },
];

export default function PokerTablePreview({ member }: { member: { displayName: string; avatarUrl: string | null } }) {
  const [action, setAction] = useState<Action | null>(null);
  const [raise, setRaise] = useState(100);
  const [remaining, setRemaining] = useState(20);
  const [running, setRunning] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPage, setMenuPage] = useState("table");
  const [displayUnit, setDisplayUnit] = useState<"chips" | "bb">("chips");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [runTwice, setRunTwice] = useState(false);
  const [multipliers, setMultipliers] = useState([2, 3, 4]);
  const [feltColor, setFeltColor] = useState<"blue" | "green" | "black">("blue");
  const [exitConfirm, setExitConfirm] = useState(false);
  const bigBlind = 100;
  const showChips = (value: number) => displayUnit === "bb" ? `${(value / bigBlind).toFixed(1)} BB` : `${value.toLocaleString()} chips`;
  useEffect(() => {
    if (!running || action || remaining === 0) return;
    const timer = window.setTimeout(() => setRemaining(t => Math.max(0, t - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [running, action, remaining]);
  const choose = (next: Action) => { if (remaining > 0) { setAction(next); setRunning(false); } };
  const reset = () => { setAction(null); setRaise(100); setRemaining(20); setRunning(true); };
  return <section className={styles.shell} aria-label="ポーカーテーブルのデザイン試作">
    <div className={styles.heading}><span>POKER SUMMIT · TEXAS HOLD'EM</span><strong>UI PREVIEW</strong></div>
    <h1>オンラインポーカー テーブル試作</h1>
    <p className={styles.notice}>ログイン中の会員アイコンと表示名を反映しています。他の5席はダミーです。これは画面・操作感を確認するためのデモです。実際の対戦、チップ増減、カード抽選、サーバー通信は行いません。</p>
    <div className={styles.table} data-felt={feltColor}>
      <div className={styles.topSeats}><Seat {...seats[0]} index={2} /></div>
      <div className={styles.edgeSeatThree}><Seat {...seats[1]} index={3} /></div>
      <div className={styles.edgeSeatFour}><Seat {...seats[2]} index={4} /></div>
      <div className={styles.felt}>
        <div className={styles.pot}>POT <strong>1,575</strong></div>
        <div className={styles.cards} aria-label="サンプル共通カード">{["6♦", "2♥", "10♣", "9♣", "—"].map((c, i) => <span key={i} className={c.includes("♥") || c.includes("♦") ? styles.red : ""}>{c}</span>)}</div>
        <div className={styles.street}>TURN · デモ表示</div>
      </div>
      <div className={styles.edgeSeatFive}><Seat {...seats[3]} index={5} /></div>
      <div className={styles.edgeSeatSix}><Seat {...seats[4]} index={6} /></div>
      <div className={styles.self}><div className={styles.activeAvatar} role="progressbar" aria-label="あなたのターン 残り時間" aria-valuemin={0} aria-valuemax={20} aria-valuenow={remaining} style={{ background: `conic-gradient(${remaining <= 5 ? "#f05b58" : "#f3c663"} ${remaining * 5}%, #42586c 0)` }}><div className={styles.avatar}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" className={styles.memberAvatarImage} referrerPolicy="no-referrer" /> : <span aria-hidden="true">{member.displayName.slice(0, 1)}</span>}</div></div><div><strong className={styles.memberName} title={member.displayName}>{member.displayName}</strong><small>2,500 chips</small></div><div className={styles.hole}><span>A♠</span><span>Q♥</span></div></div>
    </div>
    <div className={styles.controls}>
      <div className={styles.turn}>あなたの番（サンプル） · <strong aria-label={`残り${remaining}秒`}>{remaining}秒</strong></div>

      <label htmlFor="poker-demo-raise">レイズ額: {showChips(raise)}</label>
      <input id="poker-demo-raise" type="range" min={100} max={2500} step={50} value={raise} onChange={e => setRaise(Number(e.target.value))} />
      <div className={styles.quickBets}>{multipliers.map((m,i) => <button type="button" key={i} onClick={() => setRaise(Math.min(2500, m * bigBlind))}>{m}×</button>)}<button type="button" onClick={() => setRaise(2500)}>ALL-IN</button></div>
      <div className={styles.actions}>
        <button type="button" disabled={remaining === 0 || action !== null} onClick={() => choose("FOLD")}>フォールド</button>
        <button type="button" disabled={remaining === 0 || action !== null} onClick={() => choose("CHECK")}>チェック</button>
        <button type="button" disabled={remaining === 0 || action !== null} onClick={() => choose("CALL")}>コール</button>
        <button type="button" disabled={remaining === 0 || action !== null} onClick={() => choose("RAISE")}>レイズ</button>
      </div>
      <p role="status" aria-live="polite">{action ? `選択: ${action === "RAISE" ? `レイズ ${showChips(raise)}` : action}（デモのため送信されません）` : remaining === 0 ? "制限時間終了（デモ）。リセットすると再開します。" : "自分のアイコン外周が20秒のタイマーです。操作すると停止します。"}</p>
      <button className={styles.reset} type="button" onClick={reset}>デモをリセット</button>
    </div>
  </section>;
}

function Seat({ name, stack, index }: { name: string; stack: string; index: number }) {
  return <div className={styles.seat}><div className={styles.avatar}>{index}</div><span>{name}</span><small>{stack}</small></div>;
}
