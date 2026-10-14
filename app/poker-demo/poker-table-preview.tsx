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

export default function PokerTablePreview({ member, isGuestPreview = false, initialSpectating = false }: { member: { displayName: string; avatarUrl: string | null }; isGuestPreview?: boolean; initialSpectating?: boolean }) {
  const [action, setAction] = useState<Action | null>(null);
  const [showdown, setShowdown] = useState(false);
  const [raise, setRaise] = useState(100);
  const [remaining, setRemaining] = useState(20);
  const [running, setRunning] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPage, setMenuPage] = useState<"settings" | "spectate" | "exit">("settings");
  const [spectating, setSpectating] = useState(initialSpectating);
  const [seatConfirm, setSeatConfirm] = useState(false);
  const [gameType] = useState<"ring" | "tournament">("ring");
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
  const choose = (next: Action) => { if (remaining > 0 && !showdown) { setAction(next); setRunning(false); } };
  const reset = () => { setShowdown(false); setAction(null); setRaise(100); setRemaining(20); setRunning(true); };
  return <section className={styles.shell} aria-label="ポーカーテーブルのデザイン試作">
    <div className={styles.heading}>
      <button type="button" className={styles.menuToggle} aria-label="ゲームメニューを開く" aria-expanded={menuOpen} aria-controls="poker-game-menu" onClick={() => setMenuOpen(v => !v)}>☰</button>
      <span>POKER SUMMIT · TEXAS HOLD'EM</span>
      <button type="button" className={styles.topExit} aria-label="ゲームを退出" onClick={() => { setMenuPage("exit"); setExitConfirm(true); setMenuOpen(true); }}>↪</button>
    </div>
    {menuOpen && <div className={styles.menuBackdrop} aria-hidden="true" onClick={() => setMenuOpen(false)} />}
    <div id="poker-game-menu" className={styles.menuPanel} hidden={!menuOpen}>
      <div className={styles.menuTop}><strong>ゲームメニュー</strong><button type="button" aria-label="メニューを閉じる" onClick={() => setMenuOpen(false)}>×</button></div>
      <nav className={styles.menuNav} aria-label="ゲームメニュー">
        <button type="button" className={menuPage === "settings" ? styles.menuSelected : ""} onClick={() => setMenuPage("settings")}>⚙ 設定</button>
        <button type="button" className={menuPage === "spectate" ? styles.menuSelected : ""} disabled={gameType === "tournament"} onClick={() => setMenuPage("spectate")}>◉ 観戦</button>
        <button type="button" className={menuPage === "exit" ? styles.menuSelected : ""} onClick={() => { setMenuPage("exit"); setExitConfirm(false); }}>↪ 退出</button>
      </nav>
      <div className={styles.menuContent}>
        {menuPage === "settings" && <div className={styles.menuFields}>
          <h2>設定</h2>
          <label>BB表示 <input type="checkbox" checked={displayUnit === "bb"} onChange={e => setDisplayUnit(e.target.checked ? "bb" : "chips")} /></label>
          <label>SE（効果音） <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} /></label>
          <p>固定BET倍率</p>
          {multipliers.map((m, i) => <label key={i}>ボタン {i + 1}<select value={m} onChange={e => setMultipliers(prev => prev.map((v, j) => i === j ? Number(e.target.value) : v))}>{[2,2.5,3,4,5,6,8,10].map(n => <option key={n} value={n}>{n}×</option>)}</select></label>)}
          <small>BB表示と倍率はデモに反映。SEの音声再生・設定保存は未実装です。</small>
        </div>}
        {menuPage === "spectate" && <div className={styles.menuFields}><h2>観戦（リングゲーム）</h2><p>席を離れてもテーブル画面はそのまま表示します。</p><button type="button" onClick={() => { setSpectating(v => !v); setMenuOpen(false); setRunning(false); setSeatConfirm(false); }}>{spectating ? "デモの席に戻る" : "席を離れて観戦する"}</button><small>デモ表示のみ。実際のチップ精算や観戦通信は行いません。</small></div>}
        {menuPage === "exit" && <div className={styles.menuFields}><h2>退出</h2><p>ゲーム画面を終了しますか？（デモのためチップ精算はありません）</p>{!exitConfirm && <button type="button" onClick={() => setExitConfirm(true)}>退出する</button>}{exitConfirm && <><button type="button" onClick={() => { window.location.assign("/poker-lobby"); }}>退出してトップへ</button><button type="button" onClick={() => setExitConfirm(false)}>キャンセル</button></>}</div>}
      </div>
    </div>
    <h1>オンラインポーカー テーブル試作</h1>
    {isGuestPreview && <p className={styles.guestNotice}>開発Preview：ログインなしのデモ表示です。本番は会員限定です。</p>}
    <p className={styles.notice}>ログイン中の会員アイコンと表示名を反映しています。他の5席はダミーです。これは画面・操作感を確認するためのデモです。実際の対戦、チップ増減、カード抽選、サーバー通信は行いません。</p>
    <div className={styles.table} data-felt={feltColor}>
      <div className={styles.topSeats}><Seat {...seats[0]} index={2} showdown={showdown} /></div>
      <div className={styles.edgeSeatThree}><Seat {...seats[1]} index={3} showdown={showdown} /></div>
      <div className={styles.edgeSeatFour}><Seat {...seats[2]} index={4} showdown={showdown} /></div>
      <div className={styles.felt}>
        <div className={styles.pot}>POT <strong>1,575</strong></div>
        <div className={styles.cards} aria-label="サンプル共通カード">{["6♦", "2♥", "10♣", "9♣", showdown ? "K♠" : "—"].map((c, i) => <span key={i} className={c.includes("♥") || c.includes("♦") ? styles.red : ""}>{c}</span>)}</div>
        <div className={styles.street}>{showdown ? "SHOWDOWN · デモ表示" : "TURN · デモ表示"}</div>
      </div>
      <div className={styles.edgeSeatFive}><Seat {...seats[3]} index={5} showdown={showdown} /></div>
      <div className={styles.edgeSeatSix}><Seat {...seats[4]} index={6} showdown={showdown} /></div>
      {spectating && <div className={styles.spectatorSeat}><button type="button" className={styles.seatPlus} aria-label="空席に着席する" onClick={() => setSeatConfirm(true)}>＋</button><span>空席 · 着席可能</span></div>}
      {!spectating && <div className={styles.self}><div className={styles.activeAvatar} role="progressbar" aria-label="あなたのターン 残り時間" aria-valuemin={0} aria-valuemax={20} aria-valuenow={remaining} style={{ background: `conic-gradient(from 0deg, ${remaining <= 5 ? "#f05b58" : "#f3c663"} ${(20 - remaining) * 5}%, #42586c 0)` }}><div className={styles.avatar}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" className={styles.memberAvatarImage} referrerPolicy="no-referrer" /> : <span aria-hidden="true">{member.displayName.slice(0, 1)}</span>}</div></div><div><strong className={styles.memberName} title={member.displayName}>{member.displayName}</strong><small>2,500 chips</small></div>{action !== "FOLD" && <div className={styles.handWithRank}>{showdown && <strong className={styles.handRank}>ハイカード（A）</strong>}<div className={styles.hole}><span>A♠</span><span>Q♥</span></div></div>}</div>}
    </div>
    {!spectating ? <div className={styles.controls}>
      <div className={styles.turn}>あなたの番（サンプル） · <strong aria-label={`残り${remaining}秒`}>{remaining}秒</strong></div>

      <label htmlFor="poker-demo-raise">レイズ額: {showChips(raise)}</label>
      <input id="poker-demo-raise" type="range" min={100} max={2500} step={50} value={raise} onChange={e => setRaise(Number(e.target.value))} />
      <div className={styles.quickBets}>{multipliers.map((m,i) => <button type="button" key={i} onClick={() => setRaise(Math.min(2500, m * bigBlind))}>{m}×</button>)}<button type="button" onClick={() => setRaise(2500)}>ALL-IN</button></div>
      <div className={styles.actions}>
        <button type="button" disabled={remaining === 0 || action !== null || showdown} onClick={() => choose("FOLD")}>フォールド</button>
        <button type="button" disabled={remaining === 0 || action !== null} onClick={() => choose("CHECK")}>チェック</button>
        <button type="button" disabled={remaining === 0 || action !== null} onClick={() => choose("CALL")}>コール</button>
        <button type="button" disabled={remaining === 0 || action !== null} onClick={() => choose("RAISE")}>レイズ</button>
      </div>
      <p role="status" aria-live="polite">{action ? `選択: ${action === "RAISE" ? `レイズ ${showChips(raise)}` : action}（デモのため送信されません）` : remaining === 0 ? "制限時間終了（デモ）。リセットすると再開します。" : "自分のアイコン外周が20秒のタイマーです。操作すると停止します。"}</p>
      <div className={styles.demoSteps}><button type="button" onClick={() => { setShowdown(true); setRunning(false); }}>ショーダウンを表示（デモ）</button><button className={styles.reset} type="button" onClick={reset}>デモをリセット</button></div>
    </div> : <div className={styles.spectatorPanel}>観戦モード：操作ボタンは非表示です。左上の☰ → 観戦から席に戻れます。</div>}
    {seatConfirm && <div className={styles.seatOverlay}><div className={styles.seatDialog} role="dialog" aria-modal="true" aria-labelledby="seat-confirm-title"><h2 id="seat-confirm-title">着席の確認</h2><p>この空席に着席しますか？</p><p>デモのため、実際の着席やチップ移動は行いません。</p><div className={styles.seatDialogActions}><button type="button" onClick={() => setSeatConfirm(false)}>キャンセル</button><button type="button" onClick={() => { setSpectating(false); setSeatConfirm(false); reset(); }}>着席する</button></div></div></div>}
  </section>;
}

const sampleHands = [
  { cards: ["K♥", "K♦"], rank: "ワンペア（K）" },
  { cards: ["10♥", "10♠"], rank: "スリーカード（10）" },
  { cards: ["A♦", "J♦"], rank: "ハイカード（A）" },
  { cards: ["9♥", "9♦"], rank: "スリーカード（9）" },
  { cards: ["Q♠", "J♠"], rank: "ハイカード（K）" },
];
function Seat({ name, stack, index, showdown }: { name: string; stack: string; index: number; showdown: boolean }) {
  const hand = sampleHands[index - 2];
  return <div className={styles.seat}><div className={styles.avatar}>{index}</div><span>{name}</span><small>{stack}</small>{showdown && <div className={styles.opponentHand}><strong className={styles.handRank}>{hand.rank}</strong><div className={styles.miniCards}>{hand.cards.map((card, i) => <span key={i} className={card.includes("♥") || card.includes("♦") ? styles.redCard : ""}>{card}</span>)}</div></div>}</div>;
}
