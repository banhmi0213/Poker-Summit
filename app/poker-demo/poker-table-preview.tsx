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
  const [foldedSeats, setFoldedSeats] = useState<number[]>([]);
  const [streetStep, setStreetStep] = useState(0);
  const streetNames = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"] as const;
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
  const reset = () => { setFoldedSeats([]); setStreetStep(0); setShowdown(false); setAction(null); setRaise(100); setRemaining(20); setRunning(true); };
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
    <div className={styles.table} data-felt={feltColor} data-showdown={showdown ? "true" : "false"}>
      <div className={styles.topSeats}><Seat {...seats[0]} index={2} showdown={showdown} /></div>
      <div className={styles.edgeSeatThree}><Seat {...seats[1]} index={3} showdown={showdown} /></div>
      <div className={styles.edgeSeatFour}><Seat {...seats[2]} index={4} showdown={showdown} /></div>
      <div className={styles.opponentCardsLayer} aria-label="各プレイヤーのハンド（ショーダウンまでは裏向き）">
        {seats.map((seat, i) => foldedSeats.includes(i + 2) ? null : <div key={seat.name} className={`${styles.showdownPosition} ${[styles.showdownTwo, styles.showdownThree, styles.showdownFour, styles.showdownFive, styles.showdownSix][i]}`}>
          {showdown && <strong className={styles.handRank}>{sampleHands[i].rank}</strong>}
          <div className={styles.miniCards}>{sampleHands[i].cards.map((card, j) => showdown
            ? <span key={j} className={card.includes("♥") || card.includes("♦") ? styles.redCard : ""}>{card}</span>
            : <span key={j} className={styles.cardBack} aria-label="Poker Summitの親指ロゴ入り裏向きカード"><ThumbLogo /></span>)}</div>
        </div>)}
      </div>
      <div className={styles.felt}>
        <div className={styles.pot}>POT <strong>1,575</strong></div>
        <div className={styles.cards} aria-label="サンプル共通カード">{["6♦", "2♥", "10♣", "9♣", "K♠"].slice(0, streetStep === 0 ? 0 : streetStep === 1 ? 3 : streetStep === 2 ? 4 : 5).map((c, i) => <span key={i} className={c.includes("♥") || c.includes("♦") ? styles.red : ""}>{c}</span>)}</div>
        <div className={styles.street}>{streetNames[streetStep]} · デモ表示</div>
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
      <div className={styles.demoFoldControls}><span>相手のフォールド確認（デモ）</span>{seats.map((seat, i) => <button type="button" key={seat.name} aria-pressed={foldedSeats.includes(i + 2)} onClick={() => setFoldedSeats(prev => prev.includes(i + 2) ? prev.filter(n => n !== i + 2) : [...prev, i + 2])}>P{i + 2} {foldedSeats.includes(i + 2) ? "復帰" : "FOLD"}</button>)}</div>
      <div className={styles.demoSteps}><button type="button" disabled={streetStep === 4} onClick={() => { const next = Math.min(4, streetStep + 1); setStreetStep(next); setShowdown(next === 4); setRunning(false); }}>{streetStep === 4 ? "ショーダウン表示中" : `次へ：${streetNames[streetStep + 1]}（デモ）`}</button><button className={styles.reset} type="button" onClick={reset}>デモをリセット</button></div>
    </div> : <div className={styles.spectatorPanel}>観戦モード：操作ボタンは非表示です。左上の☰ → 観戦から席に戻れます。</div>}
    {seatConfirm && <div className={styles.seatOverlay}><div className={styles.seatDialog} role="dialog" aria-modal="true" aria-labelledby="seat-confirm-title"><h2 id="seat-confirm-title">着席の確認</h2><p>この空席に着席しますか？</p><p>デモのため、実際の着席やチップ移動は行いません。</p><div className={styles.seatDialogActions}><button type="button" onClick={() => setSeatConfirm(false)}>キャンセル</button><button type="button" onClick={() => { setSpectating(false); setSeatConfirm(false); reset(); }}>着席する</button></div></div></div>}
  </section>;
}

const sampleHands = [
  { cards: ["K♥", "K♦"], rank: "スリーカード（K）" },
  { cards: ["10♥", "10♠"], rank: "スリーカード（10）" },
  { cards: ["A♦", "J♦"], rank: "ハイカード（A）" },
  { cards: ["9♥", "9♦"], rank: "スリーカード（9）" },
  { cards: ["Q♠", "J♠"], rank: "ハイカード（K）" },
];
function Seat({ name, stack, index, showdown }: { name: string; stack: string; index: number; showdown: boolean }) {
  return <div className={styles.seat}><div className={styles.avatar}>{index}</div><span>{name}</span><small>{stack}</small></div>;
}

/** Small gold-outline thumbs-up mark inspired by the Poker Summit logo. */
function ThumbLogo() {
  return <svg className={styles.thumbLogo} viewBox="0 0 90 116" role="img" aria-label="Poker Summit 親指ロゴ" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M35 58 C30 45 30 35 31 17 C31 5 41 3 47 7 C53 10 54 17 54 28 L54 62 C61 62 69 64 72 72 C76 84 70 98 57 104 C43 112 27 107 20 97" />
      <path d="M35 58 C26 50 17 56 17 65 C11 61 3 66 5 76 C1 82 6 91 15 93 C16 102 26 105 33 100" />
      <path d="M17 65 C19 79 24 89 34 91 C40 94 49 91 52 84" />
      <path d="M35 58 C34 73 39 82 51 82 C56 80 59 76 67 76" />
      <path d="M6 76 C11 87 18 91 24 90" />
    </g>
  </svg>;
}
