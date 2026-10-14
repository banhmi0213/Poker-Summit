"use client";

import { useEffect, useState } from "react";
import styles from "./poker-table.module.css";
import { applyBettingAction, beginNextBettingStreet, createBettingRound, potTotal, type BettingRound, type BettingAction } from "@/lib/poker/betting";

import { postBlinds, positions, settleShowdown } from "@/lib/poker/settlement";
import type { Card } from "@/lib/poker/engine";

type Action = "FOLD" | "CHECK" | "CALL" | "RAISE";
const clockwiseSeats = ["you", "p5", "p3", "p2", "p4", "p6"];
const initialStacks: Record<string, number> = { you: 2500, p5: 2260, p3: 1850, p2: 2500, p4: 3100, p6: 1900 };
const demoBoard: Card[] = [
  {rank:6,suit:"d"}, {rank:2,suit:"h"}, {rank:10,suit:"c"}, {rank:9,suit:"c"}, {rank:13,suit:"s"}
];
const demoHoles: Record<string, [Card,Card]> = {
  you:[{rank:14,suit:"s"},{rank:12,suit:"h"}],
  p2:[{rank:13,suit:"h"},{rank:13,suit:"d"}],
  p3:[{rank:10,suit:"h"},{rank:10,suit:"s"}],
  p4:[{rank:14,suit:"d"},{rank:11,suit:"d"}],
  p5:[{rank:9,suit:"h"},{rank:9,suit:"d"}],
  p6:[{rank:12,suit:"s"},{rank:8,suit:"s"}],
};
const positionName = (id:string, buttonIndex:number) => {
  const p = positions(clockwiseSeats, buttonIndex);
  return id === p.button ? "BTN" : id === p.sb ? "SB" : id === p.bb ? "BB" : "";
};
const makeHand = (stacks:Record<string,number>, buttonIndex:number) => {
  const blinds = postBlinds(clockwiseSeats.map(id => ({id,stack:stacks[id]})),buttonIndex,50,100);
  const eligible = clockwiseSeats.slice(clockwiseSeats.indexOf(blinds.positions.preflopFirst))
    .concat(clockwiseSeats.slice(0,clockwiseSeats.indexOf(blinds.positions.preflopFirst)))
    .find(id => blinds.players.some(p=>p.id===id && !p.allIn));
  if (!eligible) return null;
  return createBettingRound(blinds.players,100,eligible);
};
const seats = [
  { name: "PLAYER 2", stack: "2,500" },
  { name: "PLAYER 3", stack: "1,850" },
  { name: "PLAYER 4", stack: "3,100" },
  { name: "PLAYER 5", stack: "2,260" },
  { name: "PLAYER 6", stack: "1,900" },
];

export default function PokerTablePreview({ member, isGuestPreview = false, initialSpectating = false }: { member: { displayName: string; avatarUrl: string | null }; isGuestPreview?: boolean; initialSpectating?: boolean }) {
  const [action, setAction] = useState<Action | null>(null);
  const [buttonIndex, setButtonIndex] = useState(5);
  const [payouts, setPayouts] = useState<Record<string,number> | null>(null);
  const [handStartingStacks, setHandStartingStacks] = useState<Record<string,number>>(initialStacks);
  const [handFinished, setHandFinished] = useState(false);
  const [lastActions, setLastActions] = useState<Record<string, string>>({});
  const [betting, setBetting] = useState<BettingRound>(() => makeHand(initialStacks,5)!);
  const [bettingMessage, setBettingMessage] = useState("SB 50 / BB 100を徴収。プリフロップはUTG（PLAYER 3）から開始（デモ）。");
  const [showdown, setShowdown] = useState(false);
  const [foldedSeats, setFoldedSeats] = useState<number[]>([]);
  const [streetStep, setStreetStep] = useState(0);
  const streetNames = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"] as const;
  const [raise, setRaise] = useState(200);
  const [remaining, setRemaining] = useState(20);
  const [timeBanksUsed, setTimeBanksUsed] = useState(0);
  const timeBankSeconds = 20;
  const demoTimeBankLimit = 1; // Future tournament configuration will supply this limit.
  const [running, setRunning] = useState(true);
  const [turnRemaining, setTurnRemaining] = useState(20);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPage, setMenuPage] = useState<"settings" | "spectate" | "exit">("settings");
  const [spectating, setSpectating] = useState(initialSpectating);
  const activePlayerId = !handFinished && !showdown && !spectating ? betting.toAct : null;
  const isYourTurn = activePlayerId === "you";
  const playerAt = (id: string) => betting.players.find(p => p.id === id)!;
  const positionFor = (id:string) => positionName(id,buttonIndex);
  const displayStack = (id:string) => (playerAt(id).stack + (payouts?.[id] ?? 0)).toLocaleString();
  const handResults = payouts ? clockwiseSeats.map(id => {
    const finalStack = playerAt(id).stack + (payouts[id] ?? 0);
    return { id, name: id === "you" ? member.displayName : "PLAYER " + id.slice(1), won: payouts[id] ?? 0, delta: finalStack - handStartingStacks[id] };
  }) : [];
  const winningPlayers = handResults.filter(p => p.won > 0);
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
    if (!running || !isYourTurn || remaining === 0) return;
    const timer = window.setTimeout(() => setRemaining(t => Math.max(0, t - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [running, isYourTurn, remaining]);
  const choose = (next: Action) => {
    if (remaining <= 0 || !isYourTurn) return;
    const player = playerAt("you");
    const owed = betting.currentBet - player.committed;
    let betAction: BettingAction;
    if (next === "FOLD") betAction = { type: "fold" };
    else if (next === "CHECK") betAction = { type: "check" };
    else if (next === "CALL") betAction = owed > 0 ? { type: "call" } : { type: "check" };
    else betAction = { type: betting.currentBet > 0 ? "raise" : "bet", amount: raise };
    try {
      const updated = applyBettingAction(betting, "you", betAction);
      setBetting(updated);
      setLastActions(prev => ({ ...prev, you: next === "RAISE" ? `${betAction.type.toUpperCase()} ${raise}` : next }));
      setAction(next);
      setRunning(false);
      setBettingMessage(`${next === "RAISE" ? "レイズ " + raise : next} を反映。残高 ${updated.players[0].stack.toLocaleString()} / POT ${potTotal(updated).toLocaleString()}（ローカルデモ）`);
    } catch (error) {
      setBettingMessage(error instanceof Error ? error.message : "操作を処理できませんでした");
    }
  };
  // Demo-only bots: check when free, otherwise call (or go all-in).
  // In a real match the server, not the browser, will own this progression.
  useEffect(() => {
    if (handFinished || showdown || spectating) return;
    const actorId = betting.toAct;
    if (!actorId || actorId === "you") return;
    const timer = window.setTimeout(() => {
      const player = betting.players.find(p => p.id === actorId);
      if (!player) return;
      const owed = betting.currentBet - player.committed;
      try {
        const next = applyBettingAction(betting, actorId, owed > 0 ? { type: "call" } : { type: "check" });
        setBetting(next);
        setLastActions(prev => ({ ...prev, [actorId]: owed > 0 ? `CALL ${Math.min(owed, player.stack)}` : "CHECK" }));
        setBettingMessage(`PLAYER ${actorId.slice(1)}：${owed > 0 ? "コール" : "チェック"}（自動デモ）`);
      } catch (error) {
        setBettingMessage(error instanceof Error ? error.message : "自動操作に失敗しました");
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [betting, handFinished, showdown, spectating]);

  // The next street begins only when every live player has acted and matched
  // the highest contribution, or cannot act because they are all-in.
  useEffect(() => {
    if (handFinished || showdown || spectating || betting.toAct !== null) return;
    const timer = window.setTimeout(() => {
      const live = betting.players.filter(p => !p.folded);
      if (live.length <= 1) {
        const winner = live[0]?.id;
        if (winner) setPayouts({ [winner]: potTotal(betting) });
        setHandFinished(true);
        setRunning(false);
        setBettingMessage(`${live[0]?.id === "you" ? "あなた" : "PLAYER " + (live[0]?.id.slice(1) ?? "")} の勝利・POT ${potTotal(betting)} を獲得（デモ）`);
        return;
      }
      if (streetStep >= 3) {
        const result = settleShowdown(betting.players.map(p=>({id:p.id,totalCommitted:p.totalCommitted,folded:p.folded,hole:demoHoles[p.id]})),demoBoard,clockwiseSeats,clockwiseSeats[buttonIndex]);
        setPayouts(result.payouts);
        const winners = [...new Set(result.awards.flatMap(a=>a.winners))];
        setStreetStep(4);
        setShowdown(true);
        setRunning(false);
        setBettingMessage(`ショーダウン：${winners.map(id=>id==="you"?"あなた":`PLAYER ${id.slice(1)}`).join("・")} がPOTを獲得（デモ）`);
        return;
      }
      const nextStep = streetStep + 1;
      // Postflop action begins at the first eligible seat clockwise from BTN (P6): SB/YOU, then BB/P5.
      const pos = positions(clockwiseSeats,buttonIndex);
      const offset = clockwiseSeats.indexOf(pos.postflopFirst);
      const ordered = [...clockwiseSeats.slice(offset),...clockwiseSeats.slice(0,offset)];
      const firstId = ordered.find(id=>betting.players.some(p=>p.id===id && !p.folded && !p.allIn));
      const first = betting.players.find(p=>p.id===firstId);
      setStreetStep(nextStep);
      if (!first) {
        // Everyone remaining is all-in: show the rest of the board.
        setStreetStep(4);
        setShowdown(true);
        setRunning(false);
        return;
      }
      setBetting(beginNextBettingStreet(betting, first.id));
      setLastActions({});
      setAction(null);
      setRemaining(20);
      setRunning(true);
      setBettingMessage(`${streetNames[nextStep]}：次のベットラウンドです（自動デモ）`);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [betting, handFinished, showdown, spectating, streetStep, buttonIndex]);

  useEffect(() => {
    if (betting.toAct === "you" && !handFinished && !showdown && !spectating) {
      setRemaining(20);
      setRunning(true);
      setAction(null);
    }
  }, [betting.toAct, handFinished, showdown, spectating]);

  useEffect(() => {
    setTurnRemaining(20);
  }, [activePlayerId, streetStep]);
  useEffect(() => {
    if (!activePlayerId || (activePlayerId === "you" && !running) || turnRemaining <= 0) return;
    const timer = window.setTimeout(() => setTurnRemaining(n => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [activePlayerId, running, turnRemaining]);

  const reset = () => {
    const stacks = Object.fromEntries(betting.players.map(p => [p.id,p.stack+(payouts?.[p.id]??0)]));
    const nextButton = (buttonIndex + 1) % clockwiseSeats.length;
    // Demo reloads starting stacks when chips run out; a real table uses a rebuy/leave flow.
    const nextRound = makeHand(stacks,nextButton) ?? makeHand(initialStacks,nextButton)!;
    setHandStartingStacks(stacks);
    setButtonIndex(nextButton); setBetting(nextRound); setPayouts(null);
    setLastActions({}); setTurnRemaining(20); setHandFinished(false);
    setBettingMessage("新しいハンド：BTNを時計回りに移動しSB 50 / BB 100を徴収しました（デモ）。");
    setFoldedSeats([]); setStreetStep(0); setShowdown(false); setAction(null);
    setRaise(200); setRemaining(20); setTimeBanksUsed(0); setRunning(true);
  };
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
    <p className={styles.notice}>ログイン中の会員アイコンと表示名を反映しています。他の5席はダミーです。これは画面・操作感を確認するためのデモです。チップとポットはローカルで試算します。実際の対戦、カード抽選、サーバー通信は行いません。</p>
    <div className={styles.table} data-felt={feltColor} data-showdown={showdown ? "true" : "false"}>
      <div className={styles.topSeats}><Seat {...seats[0]} stack={displayStack("p2")} index={2} showdown={showdown} active={activePlayerId === "p2"} seconds={turnRemaining} positionLabel={positionFor("p2")} lastAction={lastActions["p2"]} /></div>
      <div className={styles.edgeSeatThree}><Seat {...seats[1]} stack={displayStack("p3")} index={3} showdown={showdown} active={activePlayerId === "p3"} seconds={turnRemaining} positionLabel={positionFor("p3")} lastAction={lastActions["p3"]} /></div>
      <div className={styles.edgeSeatFour}><Seat {...seats[2]} stack={displayStack("p4")} index={4} showdown={showdown} active={activePlayerId === "p4"} seconds={turnRemaining} positionLabel={positionFor("p4")} lastAction={lastActions["p4"]} /></div>
      <div className={styles.opponentCardsLayer} aria-label="各プレイヤーのハンド（ショーダウンまでは裏向き）">
        {seats.map((seat, i) => (foldedSeats.includes(i + 2) || playerAt(`p${i + 2}`).folded) ? null : <div key={seat.name} className={`${styles.showdownPosition} ${[styles.showdownTwo, styles.showdownThree, styles.showdownFour, styles.showdownFive, styles.showdownSix][i]}`}>
          {showdown && <strong className={styles.handRank}>{sampleHands[i].rank}</strong>}
          <div className={styles.miniCards}>{sampleHands[i].cards.map((card, j) => showdown
            ? <span key={j} className={card.includes("♥") || card.includes("♦") ? styles.redCard : ""}>{card}</span>
            : <span key={j} className={styles.cardBack} aria-label="Poker Summitの親指ロゴ入り裏向きカード"><ThumbLogo /></span>)}</div>
        </div>)}
      </div>
      <div className={styles.felt}>
        <div className={styles.pot}>POT <strong>{potTotal(betting).toLocaleString()}</strong></div>
        <div className={styles.cards} aria-label="サンプル共通カード">{["6♦", "2♥", "10♣", "9♣", "K♠"].slice(0, streetStep === 0 ? 0 : streetStep === 1 ? 3 : streetStep === 2 ? 4 : 5).map((c, i) => <span key={i} className={c.includes("♥") || c.includes("♦") ? styles.red : ""}>{c}</span>)}</div>
        <div className={styles.street}>{streetNames[streetStep]} · デモ表示</div>
      </div>
      <div className={styles.edgeSeatFive}><Seat {...seats[3]} stack={displayStack("p5")} index={5} showdown={showdown} active={activePlayerId === "p5"} seconds={turnRemaining} positionLabel={positionFor("p5")} lastAction={lastActions["p5"]} /></div>
      <div className={styles.edgeSeatSix}><Seat {...seats[4]} stack={displayStack("p6")} index={6} showdown={showdown} active={activePlayerId === "p6"} seconds={turnRemaining} positionLabel={positionFor("p6")} lastAction={lastActions["p6"]} /></div>
      {spectating && <div className={styles.spectatorSeat}><button type="button" className={styles.seatPlus} aria-label="空席に着席する" onClick={() => setSeatConfirm(true)}>＋</button><span>空席 · 着席可能</span></div>}
      {!spectating && <div className={styles.self}><div className={`${styles.activeAvatar} ${isYourTurn ? styles.turnActive : ""}`} role="progressbar" aria-label="あなたのターン 残り時間" aria-valuemin={0} aria-valuemax={20 + timeBanksUsed * timeBankSeconds} aria-valuenow={remaining} style={{ background: `conic-gradient(from 0deg, ${remaining <= 5 ? "#f05b58" : "#f3c663"} ${Math.max(0, Math.min(100, (1 - remaining / (20 + timeBanksUsed * timeBankSeconds)) * 100))}%, #42586c 0)` }}><div className={styles.avatar}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" className={styles.memberAvatarImage} referrerPolicy="no-referrer" /> : <span aria-hidden="true">{member.displayName.slice(0, 1)}</span>}</div></div><div className={styles.selfInfo}>{positionFor("you") && <span className={styles.positionBadge}>{positionFor("you")}</span>}{lastActions.you && <span className={styles.actionBadge}>{lastActions.you}</span>}<strong className={styles.memberName} title={member.displayName}>{member.displayName}</strong><small>{showChips(playerAt("you").stack + (payouts?.you ?? 0))}</small></div>{action !== "FOLD" && <div className={styles.handWithRank}>{showdown && <strong className={styles.handRank}>ハイカード（A）</strong>}<div className={styles.hole}><span>A♠</span><span>Q♥</span></div></div>}</div>}
    </div>
      {payouts && <div className={styles.resultOverlay} role="status" aria-live="polite">
        <strong>🏆 {winningPlayers.map(p => p.name).join("・")} がPOT獲得</strong>
        <div className={styles.resultDeltas}>{handResults.map(p => <span key={p.id} className={p.delta > 0 ? styles.resultGain : p.delta < 0 ? styles.resultLoss : styles.resultEven}>{p.name} <b>{p.delta > 0 ? "+" : ""}{p.delta.toLocaleString()}</b></span>)}</div>
      </div>}
    {!spectating ? <div className={styles.controls}>
      <div className={styles.turnHeader}><div className={styles.turn}>{isYourTurn ? "あなたの番" : handFinished || showdown ? "ハンド終了" : `PLAYER ${activePlayerId?.slice(1) ?? "—"}の番`} · <strong aria-label={`残り${remaining}秒`}>{remaining}秒</strong></div><button type="button" className={styles.timeBankButton} aria-label={`タイムバンクを使用して${timeBankSeconds}秒延長`} title={`タイムバンク +${timeBankSeconds}秒（残り${demoTimeBankLimit - timeBanksUsed}回）`} disabled={timeBanksUsed >= demoTimeBankLimit || remaining === 0 || !isYourTurn || !running} onClick={() => { setRemaining(v => v + timeBankSeconds); setTimeBanksUsed(v => v + 1); setBettingMessage(`タイムバンクを使用しました。+${timeBankSeconds}秒（デモ）`); }}><span aria-hidden="true">◷</span><small>+{timeBankSeconds}s</small></button></div>

      <label htmlFor="poker-demo-raise">レイズ額: {showChips(raise)}</label>
      <input id="poker-demo-raise" type="range" min={100} max={betting.players[0].stack + betting.players[0].committed} step={50} value={raise} onChange={e => setRaise(Number(e.target.value))} />
      <div className={styles.quickBets}>{multipliers.map((m,i) => <button type="button" key={i} onClick={() => setRaise(Math.min(betting.players[0].stack + betting.players[0].committed, m * bigBlind))}>{m}×</button>)}<button type="button" onClick={() => setRaise(betting.players[0].stack + betting.players[0].committed)}>ALL-IN</button></div>
      <div className={styles.actions}>
        <button type="button" disabled={remaining === 0 || !isYourTurn} onClick={() => choose("FOLD")}>フォールド</button>
        <button type="button" disabled={remaining === 0 || !isYourTurn} onClick={() => choose("CHECK")}>チェック</button>
        <button type="button" disabled={remaining === 0 || !isYourTurn} onClick={() => choose("CALL")}>コール</button>
        <button type="button" disabled={remaining === 0 || !isYourTurn} onClick={() => choose("RAISE")}>レイズ</button>
      </div>
      <p role="status" aria-live="polite">{bettingMessage}</p>
      <div className={styles.demoFoldControls}><span>相手のフォールド確認（デモ）</span>{seats.map((seat, i) => <button type="button" key={seat.name} aria-pressed={foldedSeats.includes(i + 2)} onClick={() => setFoldedSeats(prev => prev.includes(i + 2) ? prev.filter(n => n !== i + 2) : [...prev, i + 2])}>P{i + 2} {foldedSeats.includes(i + 2) ? "復帰" : "FOLD"}</button>)}</div>
      <div className={styles.demoSteps}><button type="button" disabled onClick={() => {}}>{streetStep === 4 ? "ショーダウン表示中" : `自動進行中：${streetNames[streetStep + 1]}`}</button><button className={styles.reset} type="button" onClick={reset}>デモをリセット</button></div>
    </div> : <div className={styles.spectatorPanel}>観戦モード：操作ボタンは非表示です。左上の☰ → 観戦から席に戻れます。</div>}
    {seatConfirm && <div className={styles.seatOverlay}><div className={styles.seatDialog} role="dialog" aria-modal="true" aria-labelledby="seat-confirm-title"><h2 id="seat-confirm-title">着席の確認</h2><p>この空席に着席しますか？</p><p>デモのため、実際の着席やチップ移動は行いません。</p><div className={styles.seatDialogActions}><button type="button" onClick={() => setSeatConfirm(false)}>キャンセル</button><button type="button" onClick={() => { setSpectating(false); setSeatConfirm(false); reset(); }}>着席する</button></div></div></div>}
  </section>;
}

const sampleHands = [
  { cards: ["K♥", "K♦"], rank: "スリーカード（K）" },
  { cards: ["10♥", "10♠"], rank: "スリーカード（10）" },
  { cards: ["A♦", "J♦"], rank: "ハイカード（A）" },
  { cards: ["9♥", "9♦"], rank: "スリーカード（9）" },
  { cards: ["Q♠", "8♠"], rank: "ハイカード（K）" },
];
function Seat({ name, stack, index, active, seconds, positionLabel, lastAction }: { name: string; stack: string; index: number; showdown: boolean; active: boolean; seconds: number; positionLabel?: string; lastAction?: string }) {
  const progress = Math.max(0, Math.min(100, (1 - seconds / 20) * 100));
  return <div className={`${styles.seat} ${active ? styles.seatActive : ""}`}>
    <div className={styles.seatAvatarRow}>
      <div className={styles.seatTimerRing} style={{ background: active ? `conic-gradient(from 0deg, ${seconds <= 5 ? "#f05b58" : "#f3c663"} ${progress}%, #42586c 0)` : undefined }} aria-label={active ? `残り${seconds}秒` : undefined}><div className={styles.avatar}>{index}</div></div>

      {positionLabel && <span className={styles.seatPositionBadge}>{positionLabel}</span>}
    </div>
    <span>{name}</span><small>{stack}</small>
    {lastAction && <span className={styles.actionBadge}>{lastAction}</span>}

  </div>;
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
