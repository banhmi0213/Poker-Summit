"use client";
import {publicAction,type ActionKind} from "@/lib/poker/action-feedback";
import {playTableEffect} from "@/lib/poker/table-effects";
import {CardFace} from '@/app/poker-ui/card-face';
import {PlayerAvatar} from '@/app/poker-ui/player-avatar';
import {useTablePreferences} from '@/app/poker-ui/table-preferences';
import {BetSizeSettings} from '@/app/poker-ui/bet-size-settings';
import {presetRaiseTo} from '@/lib/poker/bet-presets';
import {TableMotionLayer,useTableActionMotion} from '@/app/poker-ui/table-action-motion';
import {usePotFlight} from '@/app/poker-ui/use-pot-flight';
import {RUNOUT_STEP_MS} from '@/lib/poker/presentation-timing';
import {SummitMark} from '@/app/poker-ui/brand-mark';

import { useEffect, useMemo, useRef, useState } from "react";
import { estimateEquity, requiredEquity } from "@/lib/poker/equity";
import { decideCpuAction, CPU_STYLES } from "@/lib/poker/cpu-strategy";
import styles from "./poker-table.module.css";
import { applyBettingAction, beginNextBettingStreet, createBettingRound, legalBettingActions, potTotal, type BettingRound, type BettingAction } from "@/lib/poker/betting";

import { initialTournamentPositions, nextTournamentPositions, finishTournamentHand, type TournamentOutcome, type TournamentPositions } from "@/lib/poker/tournament-table";
import { settleCompletedHand } from "@/lib/poker/hand-settlement";
import { cardLabel, handLabel, isRedCard, type DemoDeal } from "@/lib/poker/card-display";
import { carriedDemoStacks, startForcedHand, tournamentHandTerms, ringTerms, type HandTerms } from "@/lib/poker/tournament-hand";
import { tournamentClock, type PokerTournament } from "@/lib/poker/tournament";
import TournamentPanel from "@/app/poker-tournaments/clock-panel";
import { requestDemoDeal } from "./actions";

type Action = "FOLD" | "CHECK" | "CALL" | "RAISE";
const clockwiseSeats = ["you", "p5", "p3", "p2", "p4", "p6"];
const initialStacks: Record<string, number> = { you: 2500, p5: 2260, p3: 1850, p2: 2500, p4: 3100, p6: 1900 };
const makeHand = (stacks:Record<string,number>, buttonIndex:number, terms:HandTerms, assigned?:TournamentPositions) => startForcedHand(clockwiseSeats.filter(id=>stacks[id]>0).map(id=>({id,stack:stacks[id]})),assigned?0:buttonIndex,terms,assigned).round;
const seats = [
  { name: "PLAYER 2", stack: "2,500" },
  { name: "PLAYER 3", stack: "1,850" },
  { name: "PLAYER 4", stack: "3,100" },
  { name: "PLAYER 5", stack: "2,260" },
  { name: "PLAYER 6", stack: "1,900" },
];

export default function PokerTablePreview({ member, initialDeal, tournament, serverNow = 0, isGuestPreview = false, initialSpectating = false, initialSeatIds = clockwiseSeats, cpuMode = "thinking" }: { member: { displayName: string; avatarUrl: string | null }; initialDeal: DemoDeal; tournament?: PokerTournament; serverNow?: number; isGuestPreview?: boolean; initialSpectating?: boolean; initialSeatIds?: string[]; cpuMode?: "thinking" | "calling" }) {
  const [initialHand] = useState(() => {
    const live=tournament?clockwiseSeats.filter(id=>initialSeatIds.includes(id)):clockwiseSeats;
    const button=live.includes("p6")?"p6":live[0];
    const assigned=initialTournamentPositions(clockwiseSeats,live,button);
    const stacks=tournament?Object.fromEntries(live.map(id=>[id,tournament.structure.startingStack])):initialStacks;
    const terms=tournament?tournamentHandTerms(tournament,serverNow):ringTerms;
    const first=tournament?.structure.periods.find(p=>p.kind==="level");
    return {stacks,terms,positions:assigned,round:terms?makeHand(stacks,0,terms,assigned):createBettingRound(live.map(id=>({id,stack:stacks[id]})),first?.bb??100,live[0])};
  });
  const [now,setNow] = useState(serverNow);
  useEffect(()=>{if(!tournament)return;setNow(Date.now());const id=window.setInterval(()=>setNow(Date.now()),1000);return ()=>window.clearInterval(id);},[tournament]);
  const [handActive,setHandActive] = useState(Boolean(initialHand.terms));
  const [handTerms,setHandTerms] = useState<HandTerms|null>(initialHand.terms);
  const clock=tournament?tournamentClock(tournament.structure,tournament.starts_at,now):null;
  const canStartHand=!tournament||Boolean(tournamentHandTerms(tournament,now));
  const [deal, setDeal] = useState(initialDeal);
  const [motionHand,setMotionHand]=useState(0);
  const [dealing, setDealing] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [buttonIndex, setButtonIndex] = useState(clockwiseSeats.indexOf(initialHand.positions.button));
  const [handPositions,setHandPositions] = useState<TournamentPositions>(initialHand.positions);
  const [tournamentOutcome,setTournamentOutcome] = useState<TournamentOutcome|null>(null);
  const [payouts, setPayouts] = useState<Record<string,number> | null>(null);
  const [awardAnimationDone, setAwardAnimationDone] = useState(false);
  const tableRef=usePotFlight(Boolean(payouts && !awardAnimationDone));
  const [lastHandResult,setLastHandResult]=useState<{winners:string[];rows:{id:string;name:string;delta:number}[]}|null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(true);
  const [handStartingStacks, setHandStartingStacks] = useState<Record<string,number>>(initialHand.stacks);
  const [handFinished, setHandFinished] = useState(false);
  const [announcement,setAnnouncement]=useState<{kind:ActionKind;text:string;key:number}|null>(null);
  useEffect(()=>{if(!announcement)return;const id=setTimeout(()=>setAnnouncement(null),2600);return()=>clearTimeout(id);},[announcement]);
  const [lastActions, setLastActions] = useState<Record<string, string>>({});
  const [betting, setBetting] = useState<BettingRound>(() => initialHand.round);
  const [bettingMessage, setBettingMessage] = useState(initialHand.terms ? `SB ${initialHand.terms.sb} / BB ${initialHand.terms.bb}・Ante ${initialHand.terms.ante}を徴収しました（デモ）。` : "開始前・休憩中は強制ベットを徴収しません。開始可能になったら大会デモを開始してください。");
  const [showdown, setShowdown] = useState(false);
  // All-in with no more betting possible: cards are turned face up before the remaining board is dealt.
  const [allInReveal, setAllInReveal] = useState(false);
  const revealHoles = showdown || allInReveal;
  const [foldedSeats, setFoldedSeats] = useState<number[]>([]);
  const [streetStep, setStreetStep] = useState(0);
  const streetNames = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"] as const;
  const [raise, setRaise] = useState((initialHand.terms?.bb ?? initialHand.round.bigBlind)*2);
  const [remaining, setRemaining] = useState(20);
  const [timeBanksUsed, setTimeBanksUsed] = useState(0);
  const timeBankSeconds = 20;
  const demoTimeBankLimit = 1; // Future tournament configuration will supply this limit.
  const [autoChoice, setAutoChoice] = useState<"CHECK" | "FOLD" | null>(null);
  const [running, setRunning] = useState(true);
  const [turnRemaining, setTurnRemaining] = useState(20);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPage, setMenuPage] = useState<"settings" | "structure" | "spectate" | "exit">("settings");
  const [spectating, setSpectating] = useState(initialSpectating);
  const activePlayerId = handActive && !dealing && !handFinished && !showdown && !spectating ? betting.toAct : null;
  useTableActionMotion(tableRef,handActive?{handId:`demo-${motionHand}`,revision:0,boardCount:streetStep===0?0:streetStep===1?3:streetStep===2?4:5,settled:Boolean(payouts),players:betting.players.map(p=>({id:p.id,committed:p.committed,totalCommitted:p.totalCommitted,folded:p.folded||foldedSeats.includes(Number(p.id.slice(1)))}))}:null);
  const isYourTurn = activePlayerId === "you";
  const legal = isYourTurn ? legalBettingActions(betting, "you") : null;
  const canAct = isYourTurn && running && remaining > 0;
  const minRaiseTo = legal?.minRaiseTo ?? 0;
  const maxRaiseTo = legal?.maxRaiseTo ?? 0;
  const raiseTo = legal?.raise ? Math.min(maxRaiseTo, Math.max(minRaiseTo, raise)) : 0;
  const canRaise = canAct && Boolean(legal?.raise);
  const inHand = (id:string) => betting.players.some(p=>p.id===id);
  const playerAt = (id:string) => betting.players.find(p=>p.id===id) ?? {id,stack:0,committed:0,totalCommitted:0,folded:true,allIn:false,acted:true};
  const positionFor = (id:string) => id===handPositions.button&&id===handPositions.sb ? "BTN/SB" : id===handPositions.button ? "BTN" : id===handPositions.sb ? "SB" : id===handPositions.bb ? "BB" : id===handPositions.sbSeat&&handPositions.sb===null ? "SB不在" : "";
  const seatStatus = (id:string) => tournamentOutcome?.eliminated.some(p=>p.id===id) ? "脱落" : !inHand(id) ? "空席" : undefined;
  const playerName = (id:string) => id==="you"?member.displayName:`PLAYER ${id.slice(1)}`;
  const displayStack = (id:string) => (playerAt(id).stack + (payouts?.[id] ?? 0)).toLocaleString();
  const handResults = payouts ? betting.players.map(({id}) => {
    const finalStack = playerAt(id).stack + (payouts[id] ?? 0);
    return { id, name: id === "you" ? member.displayName : "PLAYER " + id.slice(1), won: payouts[id] ?? 0, delta: finalStack - handStartingStacks[id] };
  }) : [];
  const winningPlayers = handResults.filter(p => p.won > 0);
  const showCurrentResult=Boolean(payouts && awardAnimationDone);
  const boardRows=showCurrentResult?handResults:lastHandResult?.rows??initialSeatIds.map(id=>({id,name:playerName(id),delta:0}));
  // Animation is presentation-only; existing payouts and betting math remain authoritative.
  useEffect(() => {
    if (!payouts) { setAwardAnimationDone(false); return; }
    setAwardAnimationDone(false);
    const timer = window.setTimeout(() => setAwardAnimationDone(true), 2900);
    return () => window.clearTimeout(timer);
  }, [payouts]);
  const awardDestinations: Record<string, string> = {
    p2: styles.awardP2, p3: styles.awardP3, p4: styles.awardP4,
    p5: styles.awardP5, p6: styles.awardP6, you: styles.awardYou,
  };
  const awardWinners = payouts ? clockwiseSeats.filter(id => (payouts[id] ?? 0) > 0) : [];
  const [soundEnabled, setSoundEnabled] = useState(true);
  soundEnabledRef.current = soundEnabled;
  // Unlock Web Audio from any genuine user gesture, including menu and action buttons.
  // Playback is synthesized locally and does not require audio assets.
  const unlockAudio = () => {
    if (typeof window === "undefined") return;
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume();
    } catch { /* Audio is optional. */ }
  };
  type SoundKind = "turn" | "action" | "deal" | "flop" | "turnCard" | "river" | "win" | ActionKind;
  const playSound = (kind: SoundKind) => {
    if (!soundEnabledRef.current) return;
    const context = audioContextRef.current;
    if (!context || context.state !== "running") return;
    try {
      const now = context.currentTime;
      const tone = (frequency: number, delay: number, duration: number, volume: number, wave: OscillatorType = "sine") => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        const start = now + delay;
        osc.type = wave; osc.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain); gain.connect(context.destination);
        osc.start(start); osc.stop(start + duration + 0.015);
      };
      if (kind === "turnCard") {
        playTableEffect(context, "turn");
      } else if (["fold","check","call","bet","raise","allin","deal","flop","river","win"].includes(kind)) {
        playTableEffect(context, kind as ActionKind | "deal" | "flop" | "river" | "win");
      } else if (kind === "turn") {
        tone(880, 0, 0.13, 0.12); tone(1174.66, 0.045, 0.15, 0.065);
      } else if (kind === "action") {
        tone(310, 0, 0.085, 0.085, "triangle");
      }
    } catch { /* Audio must never interrupt the game. */ }
  };
  const previewSound = (kind: SoundKind) => {
    unlockAudio();
    // Wait for the resume to finish instead of a fixed delay, so the first tap also plays.
    const context = audioContextRef.current;
    if (context && context.state !== "running") void context.resume().then(() => playSound(kind)).catch(() => {});
    else playSound(kind);
  };
  useEffect(() => {
    const activate = () => {
      try {
        if (!audioContextRef.current) audioContextRef.current = new AudioContext();
        if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume();
      } catch { /* Audio is optional. */ }
    };
    document.addEventListener("pointerdown", activate, { passive: true });
    document.addEventListener("keydown", activate);
    return () => {
      document.removeEventListener("pointerdown", activate);
      document.removeEventListener("keydown", activate);
      void audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!payouts || !soundEnabled) return;
    const timer = window.setTimeout(() => playSound("win"), 180);
    return () => window.clearTimeout(timer);
  }, [payouts, soundEnabled]);
  const previousActorRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const actor = handActive && !handFinished && !showdown && !spectating ? betting.toAct : null;
    const previous = previousActorRef.current;
    previousActorRef.current = actor;
    if (previous === undefined || previous === actor || actor !== "you") return;
    playSound("turn");
  }, [betting.toAct, handFinished, showdown, spectating, handActive]);
  // Hole cards for a new hand: the same "deal" sound as the online tables.
  const previousHandRef = useRef(motionHand);
  useEffect(() => {
    if (previousHandRef.current === motionHand) return;
    previousHandRef.current = motionHand;
    playSound("deal");
  }, [motionHand]);
  const previousStreetRef = useRef(streetStep);
  useEffect(() => {
    if (previousStreetRef.current === streetStep) return;
    previousStreetRef.current = streetStep;
    if (streetStep > 0 && streetStep < 4) playSound(streetStep === 1 ? "flop" : streetStep === 2 ? "turnCard" : "river");
  }, [streetStep]);


  const [seatConfirm, setSeatConfirm] = useState(false);
  const gameType = tournament ? "tournament" : "ring";
  const {settings:displayPreferences,change:changeDisplayPreferences}=useTablePreferences();
  const displayUnit=displayPreferences.bb?"bb":"chips";
  const setDisplayUnit=(value:"bb"|"chips")=>changeDisplayPreferences({bb:value==="bb"});
  const [runTwice, setRunTwice] = useState(false);
  const {settings:betPreferences}=useTablePreferences();
  const multipliers=betPreferences.multipliers;
  const [feltColor, setFeltColor] = useState<"blue" | "green" | "black">("blue");
  const [exitConfirm, setExitConfirm] = useState(false);
  const bigBlind = betting.bigBlind;
  const tournamentComplete = Boolean(tournament && tournamentOutcome?.champion);
  const remainingIds = tournamentOutcome?.liveIds ?? betting.players.map(p=>p.id);
  const showChips = (value: number) => displayUnit === "bb" ? `${(value / bigBlind).toFixed(1)} BB` : `${value.toLocaleString()} chips`;
  useEffect(() => {
    if (!running || !isYourTurn || remaining === 0) return;
    const timer = window.setTimeout(() => setRemaining(t => Math.max(0, t - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [running, isYourTurn, remaining]);
  const choose = (next: Action, automatic = false) => {
    if (!isYourTurn || !running || (!automatic && remaining <= 0) || !legal) return;
    if ((next === "CHECK" && !legal.check) || (next === "CALL" && !legal.call) || (next === "RAISE" && !legal.raise)) return;
    let betAction: BettingAction;
    if (next === "FOLD") betAction = { type: "fold" };
    else if (next === "CHECK") betAction = { type: "check" };
    else if (next === "CALL") betAction = { type: "call" };
    else betAction = { type: betting.currentBet > 0 ? "raise" : "bet", amount: raiseTo };
    try {
      const updated = applyBettingAction(betting, "you", betAction);
      const cue=publicAction(betting.players,updated.players,"you");
      if(cue){playSound(cue.kind);setAnnouncement({kind:cue.kind,text:`${member.displayName} · ${cue.label}${cue.amount?` ${showChips(cue.amount)}`:""}`,key:Date.now()});}
      setBetting(updated);
      setLastActions(prev => ({ ...prev, you: automatic ? `AUTO ${next}` : next === "RAISE" ? `${betAction.type.toUpperCase()} ${raiseTo}` : next }));
      setAction(next);
      setAutoChoice(null);
      setRunning(false);
      setBettingMessage(`${automatic ? "AUTO " : ""}${next === "RAISE" ? (betting.currentBet > 0 ? "レイズ " : "ベット ") + raiseTo : next} を反映.残高 ${updated.players[0].stack.toLocaleString()} / POT ${potTotal(updated).toLocaleString()}（ローカルデモ）`);
    } catch (error) {
      setBettingMessage(error instanceof Error ? error.message : "操作を処理できませんでした");
    }
  };
  const owedForYou = Math.max(0, betting.currentBet - playerAt("you").committed);
  // 練習ヒント(2026/10/26): 自分の番だけ、見えているカードから必要勝率と推定勝率を出す。デモ卓専用。
  const [hintsOn, setHintsOn] = useState(true);
  const hintBoard = deal.board.slice(0, streetStep === 0 ? 0 : streetStep === 1 ? 3 : streetStep === 2 ? 4 : 5);
  const hintOpponents = betting.players.filter(p => p.id !== "you" && !p.folded).length;
  const hint = useMemo(() => {
    if (!hintsOn || !isYourTurn || !deal.holes.you || hintOpponents < 1) return null;
    const pot = potTotal(betting), toCall = Math.min(owedForYou, playerAt("you").stack);
    return { equity: estimateEquity(deal.holes.you, hintBoard, Math.min(hintOpponents, 8), 1200).equity, required: requiredEquity(toCall, pot), toCall, pot };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintsOn, isYourTurn, deal, streetStep, hintOpponents, owedForYou, betting.currentBet]);
  // Auto actions never spend chips without explicit consent.
  useEffect(() => {
    if (!isYourTurn || !running || handFinished || showdown || spectating) return;
    const preferred = autoChoice === "FOLD" ? "FOLD" : owedForYou === 0 ? "CHECK" : "FOLD";
    if (remaining !== 0 && autoChoice === null) return;
    const timer = window.setTimeout(() => choose(preferred, true), 0);
    return () => window.clearTimeout(timer);
  }, [remaining, isYourTurn, autoChoice, owedForYou, running, handFinished, showdown, spectating]);
  // Demo-only CPU players (2026/10/26): each decides from its own cards and the public table, with its own style.
  // In a real match the server, not the browser, will own this progression.
  useEffect(() => {
    if (!handActive || dealing || handFinished || showdown || spectating) return;
    const actorId = betting.toAct;
    if (!actorId || actorId === "you") return;
    const timer = window.setTimeout(() => {
      const player = betting.players.find(p => p.id === actorId);
      if (!player) return;
      const owed = betting.currentBet - player.committed;
      const legal = legalBettingActions(betting, actorId);
      const cpuStyles: Record<string, keyof typeof CPU_STYLES> = { p2: "standard", p3: "tight", p4: "loose", p5: "aggressive", p6: "standard" };
      const board = deal.board.slice(0, streetStep === 0 ? 0 : streetStep === 1 ? 3 : streetStep === 2 ? 4 : 5);
      // 練習卓のCPUは自分の手札と公開情報で考えて打つ（大会のチップが少ない場面はプッシュ/フォールド表）。cpuMode='calling' は進行確認テスト専用。
      const decision: BettingAction = cpuMode !== "calling" && legal && deal.holes[actorId] ? decideCpuAction({
        hole: deal.holes[actorId], board, pot: potTotal(betting), toCall: legal.callAmount, stack: player.stack, committed: player.committed,
        currentBet: betting.currentBet, bigBlind: betting.bigBlind, legal,
        opponents: betting.players.filter(p => p.id !== actorId && !p.folded).length,
        playersBehind: betting.players.filter(p => p.id !== actorId && !p.folded && !p.allIn && !p.acted).length,
        isBigBlind: handPositions.bb === actorId,
        maxOpponentStack: Math.max(0, ...betting.players.filter(p => p.id !== actorId && !p.folded).map(p => p.stack + p.committed)),
      }, CPU_STYLES[cpuStyles[actorId] ?? "standard"]) : (owed > 0 ? { type: "call" } : { type: "check" });
      const label = decision.type === "fold" ? "FOLD" : decision.type === "check" ? "CHECK" : decision.type === "call" ? `CALL ${Math.min(owed, player.stack)}` : `${decision.type === "bet" ? "BET" : "RAISE"} ${decision.amount}`;
      const word = decision.type === "fold" ? "フォールド" : decision.type === "check" ? "チェック" : decision.type === "call" ? "コール" : decision.type === "bet" ? `ベット ${decision.amount}` : `レイズ ${decision.amount}`;
      try {
        const next = applyBettingAction(betting, actorId, decision);
        setBetting(next);
        setLastActions(prev => ({ ...prev, [actorId]: label }));
        const cue=publicAction(betting.players,next.players,actorId);
        if(cue){playSound(cue.kind);setAnnouncement({kind:cue.kind,text:`PLAYER ${actorId.slice(1)} · ${cue.label}${cue.amount?` ${showChips(cue.amount)}`:""}`,key:Date.now()});}
        setBettingMessage(`PLAYER ${actorId.slice(1)}：${word}（CPU）`);
      } catch (error) {
        setBettingMessage(error instanceof Error ? error.message : "自動操作に失敗しました");
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [betting, handFinished, showdown, spectating, dealing, handActive, deal, streetStep, handPositions, cpuMode]);

  // The next street begins only when every live player has acted and matched
  // the highest contribution, or cannot act because they are all-in.
  useEffect(() => {
    if (!handActive || dealing || handFinished || showdown || spectating || betting.toAct !== null) return;
    const timer = window.setTimeout(() => {
      const result = settleCompletedHand(betting, deal.board, deal.holes, clockwiseSeats, clockwiseSeats[buttonIndex], streetStep >= 3);
      if (result?.showdown && streetStep < 3) {
        setAllInReveal(true);
        setStreetStep(step => step + 1);
        setBettingMessage(`${streetNames[streetStep + 1]}：オールイン後のカード公開（デモ）`);
        return;
      }
      if (result) {
        if(tournament && handTerms) {
          const outcome=finishTournamentHand(betting,handStartingStacks,result.payouts,handTerms.anteType,tournamentOutcome?.eliminated??[]);
          setTournamentOutcome(outcome);
        }
        setLastHandResult({winners:result.winners.map(playerName),rows:betting.players.map(p=>({id:p.id,name:playerName(p.id),delta:p.stack+(result.payouts[p.id]??0)-handStartingStacks[p.id]}))});
        setPayouts(result.payouts);
        setHandFinished(true);
        setRunning(false);
        if (result.showdown) {
          setStreetStep(4);
          setShowdown(true);
        }
        setBettingMessage(`${result.showdown ? "ショーダウン：" : ""}${result.winners.map(id=>id==="you"?"あなた":`PLAYER ${id.slice(1)}`).join("・")} がPOTを獲得（デモ）`);
        return;
      }
      const nextStep = streetStep + 1;
      // Postflop action begins at the first eligible seat clockwise from BTN (P6): SB/YOU, then BB/P5.
      const pos = handPositions;
      const offset = clockwiseSeats.indexOf(pos.postflopFirst);
      const ordered = [...clockwiseSeats.slice(offset),...clockwiseSeats.slice(0,offset)];
      const firstId = ordered.find(id=>betting.players.some(p=>p.id===id && !p.folded && !p.allIn));
      setStreetStep(nextStep);
      setBetting(beginNextBettingStreet(betting, firstId!));
      setLastActions({});
      setAction(null);
      setRemaining(20);
      setRunning(true);
      setBettingMessage(`${streetNames[nextStep]}：次のベットラウンドです（自動デモ）`);
    }, RUNOUT_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [betting, handFinished, showdown, spectating, streetStep, buttonIndex, deal, dealing, handActive, handPositions, tournament, handTerms, handStartingStacks, tournamentOutcome]);

  useEffect(() => {
    if (handActive && betting.toAct === "you" && !handFinished && !showdown && !spectating) {
      setRemaining(20);
      setRunning(true);
      setAction(null);
    }
  }, [betting.toAct, handFinished, showdown, spectating, handActive]);

  useEffect(() => {
    setTurnRemaining(20);
  }, [activePlayerId, streetStep]);
  useEffect(() => {
    if (!activePlayerId || (activePlayerId === "you" && !running) || turnRemaining <= 0) return;
    const timer = window.setTimeout(() => setTurnRemaining(n => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [activePlayerId, running, turnRemaining]);

  const reset = async () => {
    if (dealing || tournamentComplete) return;
    const terms=tournament?tournamentHandTerms(tournament,Date.now()):ringTerms;
    if (!terms) { setBettingMessage("開始前・休憩中のため、新しいハンドは開始できません。"); return; }
    const carried=carriedDemoStacks(betting,payouts);
    const needsRefill=!tournament&&Object.values(carried).some(stack=>stack<=0);
    const startingStacks=needsRefill?initialStacks:carried;
    const live=clockwiseSeats.filter(id=>(startingStacks[id]??0)>0);
    if(live.length<2){setBettingMessage("大会終了：優勝が確定しました。");return;}
    const nextPos=handActive?(tournament?nextTournamentPositions(clockwiseSeats,live,handPositions):initialTournamentPositions(clockwiseSeats,live,clockwiseSeats[(buttonIndex+1)%clockwiseSeats.length])):handPositions;
    const nextButton=clockwiseSeats.indexOf(nextPos.button);
    setDealing(true);
    try {
      const nextDeal=await requestDemoDeal(nextButton,live);
      const nextRound=makeHand(startingStacks,nextButton,terms,nextPos);
      // Clear the previous reveal/awards before changing the participating roster.
      setPayouts(null);setShowdown(false);setAllInReveal(false);setStreetStep(0);
      setHandStartingStacks(Object.fromEntries(live.map(id=>[id,startingStacks[id]])));setHandTerms(terms);setHandActive(true);setHandPositions(nextPos);
      setDeal(nextDeal);setMotionHand(v=>v+1);setButtonIndex(nextButton);setBetting(nextRound);setPayouts(null);
      setLastActions({});setTurnRemaining(20);setHandFinished(false);
      setBettingMessage(`新しいカードを配布。${tournament?`残り${live.length}人・LV${terms.level}・`:""}SB ${terms.sb} / BB ${terms.bb}・Ante ${terms.ante}を徴収しました。${nextPos.sb===null?"SBは不在のため未徴収。":""}${needsRefill?"残高0の席があるため、リングデモ全席を初期残高に補充しました。":""}`);
      setFoldedSeats([]);setStreetStep(0);setShowdown(false);setAllInReveal(false);setAction(null);
      setAutoChoice(null);setRaise(terms.bb*2);setRemaining(20);setTimeBanksUsed(0);setRunning(true);
    } catch(error) {
      setBettingMessage(error instanceof Error?error.message:"配布に失敗しました。もう一度お試しください");
    } finally {setDealing(false);}
  };
  const streetBet = (id: string) => {
    const p = playerAt(id);
    if (payouts || p.committed <= 0) return null;
    const blind = streetStep === 0 && !lastActions[p.id] ? p.id===handPositions.sb ? "SB" : p.id===handPositions.bb ? "BB" : "" : "";
    return <div key={p.id} data-motion-bet={p.id} className={`${styles.streetBet} ${styles[`bet_${p.id}`]}`} aria-label={`${p.id === "you" ? "あなた" : `PLAYER ${p.id.slice(1)}`}：${blind ? blind + " " : ""}ベット ${showChips(p.committed)}`}>
      <span className={styles.betChip} aria-hidden="true">♠</span>
      <span>{blind && <b>{blind} </b>}{displayUnit === "bb" ? `${(p.committed / bigBlind).toFixed(1)} BB` : p.committed.toLocaleString()}</span>
    </div>;
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
        {tournament && <button type="button" className={menuPage === "structure" ? styles.menuSelected : ""} onClick={() => setMenuPage("structure")}>ストラクチャー</button>}
        <button type="button" className={menuPage === "spectate" ? styles.menuSelected : ""} disabled={gameType === "tournament"} onClick={() => setMenuPage("spectate")}>◉ 観戦</button>
        <button type="button" className={menuPage === "exit" ? styles.menuSelected : ""} onClick={() => { setMenuPage("exit"); setExitConfirm(false); }}>↪ 退出</button>
      </nav>
      <div className={styles.menuContent}>
        {menuPage === "settings" && <div className={styles.menuFields}>
          <h2>設定</h2>
          <label>BB表示 <input type="checkbox" checked={displayUnit === "bb"} onChange={e => setDisplayUnit(e.target.checked ? "bb" : "chips")} /></label>
          <label>SE（効果音） <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} /></label>
          <label>練習ヒント（勝率の目安） <input type="checkbox" checked={hintsOn} onChange={e => setHintsOn(e.target.checked)} /></label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {([["deal","配る"],["flop","フロップ"],["turnCard","ターン"],["river","リバー"],["fold","フォールド"],["check","チェック"],["call","コール"],["bet","ベット"],["raise","レイズ"],["allin","オールイン"],["win","ポット獲得"],["turn","自分の番"],["action","相手の行動"]] as [SoundKind,string][]).map(([kind,label]) =>
              <button key={kind} type="button" disabled={!soundEnabled} onClick={() => previewSound(kind)}>♪ {label}</button>)}
          </div>
          <p>レイズ額の設定</p>
          <BetSizeSettings/>
          <small>BB表示と倍率はデモに反映。SEは各場面で再生されます（上のボタンで1つずつ試せます）。レイズ額の設定は会員ごとに保存できます。</small>
        </div>}
        {menuPage === "structure" && tournament && <div className={styles.menuFields}><TournamentPanel tournament={tournament} serverNow={serverNow} mode="structure"/></div>}
        {menuPage === "spectate" && <div className={styles.menuFields}><h2>観戦（リングゲーム）</h2><p>席を離れてもテーブル画面はそのまま表示します。</p><button type="button" onClick={() => { setSpectating(v => !v); setMenuOpen(false); setRunning(false); setSeatConfirm(false); }}>{spectating ? "デモの席に戻る" : "席を離れて観戦する"}</button><small>デモ表示のみ。実際のチップ精算や観戦通信は行いません。</small></div>}
        {menuPage === "exit" && <div className={styles.menuFields}><h2>退出</h2><p>ゲーム画面を終了しますか？（デモのためチップ精算はありません）</p>{!exitConfirm && <button type="button" onClick={() => setExitConfirm(true)}>退出する</button>}{exitConfirm && <><button type="button" onClick={() => { window.location.assign("/poker-lobby"); }}>退出してトップへ</button><button type="button" onClick={() => setExitConfirm(false)}>キャンセル</button></>}</div>}
      </div>
    </div>
    <details className={styles.demoInfo}><summary>デモについて</summary><h1>オンラインポーカー テーブル試作</h1><p>チップと進行はブラウザ内のデモです。会員残高とは連携していません。</p></details>
    <aside className={styles.desktopStructure} aria-label="大会ストラクチャー">{tournament ? <TournamentPanel tournament={tournament} serverNow={serverNow} mode="structure"/> : <><h2>リングゲーム</h2><p>SB 50 / BB 100</p><p>ブラウザ内のゲーム進行デモです。</p><a href="/poker-lobby">ロビーへ戻る</a></>}</aside>
    {tournament && <div className={styles.gameClock}><TournamentPanel tournament={tournament} serverNow={serverNow} gameLinked/></div>}
    {tournament && <div className={styles.statusDock}><details className={styles.tournamentStatus} open={tournamentComplete}><summary>大会状況・結果：残り {remainingIds.length}人{tournamentComplete?"・大会終了":""}</summary><div role="status">
      {handActive && handTerms ? <p>現在のハンド：LV{handTerms.level} ／ SB {handTerms.sb.toLocaleString()} / BB {handTerms.bb.toLocaleString()} ／ Ante {handTerms.ante.toLocaleString()}（{handTerms.anteType==="bb"?"BBアンティ・BB優先":handTerms.anteType==="per-player"?"全員アンティ":"なし"}）</p> : <p>現在のハンド：未開始（強制ベット未徴収）</p>}
      {clock?.phase==="scheduled"?<p>開始待ち：開始時刻になったら「大会デモを開始」を押してください。</p>:clock?.phase==="break"?<p>休憩中：進行中のハンドは継続し、新しいハンドは休憩終了後に開始できます。</p>:<p>レベル変更は次のハンドから適用します。</p>}
      {handActive && <p>このハンドで徴収したアンティ合計：{betting.players.reduce((n,p)=>n+(p.anteCommitted??0),0).toLocaleString()}（POTに含む・コール額には含まない）</p>}
      <p>残り {remainingIds.length}人 ／ 開始 {initialSeatIds.length}人{remainingIds.length===2?"・ヘッズアップ":""}</p>
      {!inHand(handPositions.button) && <p>デッドボタン：{playerName(handPositions.button)}の空席にBTNを置いて進行しています。</p>}
      {tournamentOutcome && !remainingIds.includes("you") && <p>あなたは脱落しました。残ったプレイヤーの進行を確認できます。</p>}
      {tournamentComplete && <section aria-label="大会終了結果"><p><strong>大会終了・優勝：{playerName(tournamentOutcome!.champion!)}</strong></p><p>結果ログを確認してから退出できます。</p><button type="button" className={styles.reset} onClick={() => window.location.assign("/poker-lobby")}>退出する</button></section>}
      {Boolean(tournamentOutcome?.eliminated.length) && <details aria-label="大会結果ログ" open={tournamentComplete}><summary>大会結果ログ（デモ順位）</summary><ul>{tournamentOutcome?.champion && <li>1位：{playerName(tournamentOutcome.champion)}</li>}{tournamentOutcome?.eliminated.map(p=><li key={p.id}>{p.place===p.tiedThrough?`${p.place}位`:`同順位（${p.place}〜${p.tiedThrough}位）`}：{playerName(p.id)}</li>)}</ul><small>このブラウザ内のデモ結果です。会員戦績・プライズ付与には未連携です。</small></details>}
    </div></details></div>}
    <div ref={tableRef} className={styles.table} onPointerDown={unlockAudio} data-felt={feltColor} data-showdown={showdown ? "true" : "false"} data-street={streetStep}><TableMotionLayer/>
      {payouts && !awardAnimationDone && <div className={styles.awardAnimationLayer} aria-hidden="true">
        {awardWinners.map(id => <div key={id} data-pot-winner={id} className={`${styles.awardFlight} ${awardDestinations[id]}`}>
          <span data-pot-coin className={styles.awardCoin}>♠</span><span data-pot-coin className={styles.awardCoin}>♠</span><span data-pot-coin className={styles.awardCoin}>♠</span>
          <b className={styles.awardAmount}>+{payouts[id].toLocaleString()}</b>
        </div>)}
      </div>}
      <div className={styles.topSeats}><Seat {...seats[0]} stack={displayStack("p2")} index={2} winnerGlow={Boolean(payouts?.p2)} showdown={showdown} active={activePlayerId === "p2"} seconds={turnRemaining} seatStatus={seatStatus("p2")} positionLabel={positionFor("p2")} lastAction={lastActions["p2"]} />{streetBet("p2")}</div>
      <div className={styles.edgeSeatThree}><Seat {...seats[1]} stack={displayStack("p3")} index={3} winnerGlow={Boolean(payouts?.p3)} showdown={showdown} active={activePlayerId === "p3"} seconds={turnRemaining} seatStatus={seatStatus("p3")} positionLabel={positionFor("p3")} lastAction={lastActions["p3"]} /></div>
      <div className={styles.edgeSeatFour}><Seat {...seats[2]} stack={displayStack("p4")} index={4} winnerGlow={Boolean(payouts?.p4)} showdown={showdown} active={activePlayerId === "p4"} seconds={turnRemaining} seatStatus={seatStatus("p4")} positionLabel={positionFor("p4")} lastAction={lastActions["p4"]} /></div>
      <div className={styles.opponentCardsLayer} aria-label="各プレイヤーのハンド（ショーダウンまでは裏向き）">
        {seats.map((seat, i) => (!handActive || !deal.holes[`p${i + 2}`] || foldedSeats.includes(i + 2) || playerAt(`p${i + 2}`).folded) ? null : <div key={seat.name} className={`${styles.showdownPosition} ${[styles.showdownTwo, styles.showdownThree, styles.showdownFour, styles.showdownFive, styles.showdownSix][i]}`}>
          {showdown && <strong className={styles.handRank}>{handLabel(deal.holes[`p${i + 2}`], deal.board)}</strong>}
          <div className={styles.miniCards} data-motion-hole={`p${i+2}`}>{deal.holes[`p${i + 2}`].map((card, j) => revealHoles
            ? <span key={j} className={isRedCard(card) ? styles.redCard : ""}><CardFace card={card}/></span>
            : <span key={j} className={styles.cardBack} aria-label="Poker Summitの親指ロゴ入り裏向きカード"><ThumbLogo /></span>)}</div>
        </div>)}
      </div>
      <div className={styles.streetBets} aria-label="各席のベット額">
        {clockwiseSeats.filter(id => id !== "p2").map(streetBet)}
      </div>
      {announcement&&<div key={announcement.key} className={styles.actionToast} data-kind={announcement.kind} role="status" aria-live="polite">{announcement.text}</div>}
      <div className={styles.felt}>
        <div data-pot-source className={styles.pot}>POT <strong>{potTotal(betting).toLocaleString()}</strong></div>
        <div className={styles.cards} aria-label="共通カード" data-motion-board>{deal.board.slice(0, streetStep === 0 ? 0 : streetStep === 1 ? 3 : streetStep === 2 ? 4 : 5).map((card, i) => <span key={i} className={isRedCard(card) ? styles.red : ""}><CardFace card={card}/></span>)}</div>
        <div className={styles.street}>{streetNames[streetStep]} · デモ表示</div>
      </div>
      <div className={styles.edgeSeatFive}><Seat {...seats[3]} stack={displayStack("p5")} index={5} winnerGlow={Boolean(payouts?.p5)} showdown={showdown} active={activePlayerId === "p5"} seconds={turnRemaining} seatStatus={seatStatus("p5")} positionLabel={positionFor("p5")} lastAction={lastActions["p5"]} /></div>
      <div className={styles.edgeSeatSix}><Seat {...seats[4]} stack={displayStack("p6")} index={6} winnerGlow={Boolean(payouts?.p6)} showdown={showdown} active={activePlayerId === "p6"} seconds={turnRemaining} seatStatus={seatStatus("p6")} positionLabel={positionFor("p6")} lastAction={lastActions["p6"]} /></div>
      {spectating && <div className={styles.spectatorSeat}><button type="button" className={styles.seatPlus} aria-label="空席に着席する" onClick={() => setSeatConfirm(true)}>＋</button><span>空席 · 着席可能</span></div>}
      {!spectating && <div className={styles.self}><div className={`${styles.activeAvatar} ${isYourTurn ? styles.turnActive : ""} ${payouts?.you ? styles.winnerGlow : ""}`} role="progressbar" aria-label="あなたのターン 残り時間" aria-valuemin={0} aria-valuemax={20 + timeBanksUsed * timeBankSeconds} aria-valuenow={remaining} style={{ background: `conic-gradient(from 0deg, ${remaining <= 5 ? "#f05b58" : "#f3c663"} ${Math.max(0, Math.min(100, (1 - remaining / (20 + timeBanksUsed * timeBankSeconds)) * 100))}%, #42586c 0)` }}><div data-pot-target="you" data-motion-stack="you" className={styles.avatar}><PlayerAvatar url={member.avatarUrl} name={member.displayName} className={styles.memberAvatarImage}/></div></div><div className={styles.selfInfo}>{positionFor("you") && <span className={styles.positionBadge}>{positionFor("you")}</span>}{lastActions.you && <span className={styles.actionBadge}>{lastActions.you}</span>}{seatStatus("you") && <span className={styles.eliminatedTag}>{seatStatus("you")}</span>}<strong className={styles.memberName} title={member.displayName}>{member.displayName}</strong><small>{showChips(playerAt("you").stack + (payouts?.you ?? 0))}</small></div>{handActive && inHand("you") && deal.holes.you && action !== "FOLD" && <div className={styles.handWithRank}>{showdown && <strong className={styles.handRank}>{handLabel(deal.holes.you, deal.board)}</strong>}<div className={styles.hole} data-motion-hole="you">{deal.holes.you.map((card, i) => <span key={i} className={isRedCard(card) ? styles.redCard : styles.blackCard}><CardFace card={card}/></span>)}</div></div>}</div>}
    </div>
    <div className={styles.actionColumn}>
      {<div className={`${styles.resultOverlay} ${showCurrentResult?"":styles.previousResult}`} role="status" aria-live="polite">
        <strong>{showCurrentResult?`🏆 ${winningPlayers.map(p=>p.name).join("・")} がPOT獲得`:lastHandResult?`前ハンド：${lastHandResult.winners.join("・")} がPOT獲得`:"ハンド結果：確定待ち"}</strong>
        <div className={styles.resultDeltas}>{boardRows.map(p => <span key={p.id} className={p.delta > 0 ? styles.resultGain : p.delta < 0 ? styles.resultLoss : styles.resultEven}>{p.name} <b>{p.delta > 0 ? "+" : ""}{p.delta.toLocaleString()}</b></span>)}</div>
      </div>}
    {!spectating ? <div className={styles.controls}>
      <div className={styles.turnHeader}><div className={styles.turn}>{tournamentComplete ? "大会終了" : !handActive ? "ハンド開始待ち" : !inHand("you") ? "脱落・進行確認中" : isYourTurn ? "あなたの番" : handFinished || showdown ? "ハンド終了" : `PLAYER ${activePlayerId?.slice(1) ?? "—"}の番`} · <strong aria-label={`残り${remaining}秒`}>{remaining}秒</strong></div><button type="button" className={styles.timeBankButton} aria-label={`タイムバンクを使用して${timeBankSeconds}秒延長`} title={`タイムバンク +${timeBankSeconds}秒（残り${demoTimeBankLimit - timeBanksUsed}回）`} disabled={timeBanksUsed >= demoTimeBankLimit || remaining === 0 || !isYourTurn || !running} onClick={() => { setRemaining(v => v + timeBankSeconds); setTimeBanksUsed(v => v + 1); setBettingMessage(`タイムバンクを使用しました。+${timeBankSeconds}秒（デモ）`); }}><span aria-hidden="true">◷</span><small>+{timeBankSeconds}s</small></button></div>

      {hint && <p className={styles.hint} role="note">{hint.toCall > 0 ? <>必要勝率 <b>{Math.round(hint.required * 100)}%</b>（{hint.toCall.toLocaleString()}をコールしてPOT {(hint.pot + hint.toCall).toLocaleString()}）・</> : null}推定勝率 <b>{Math.round(hint.equity * 100)}%</b><small>相手の手札をランダムと仮定した目安</small></p>}
      <label htmlFor="poker-demo-raise">{betting.currentBet > 0 ? "レイズ後の合計額" : "ベット額"}: {legal?.raise ? showChips(raiseTo) : "—"}</label>
      <input aria-label="レイズ額スライダー" id="poker-demo-raise" type="range" min={minRaiseTo} max={maxRaiseTo} step={1} value={raiseTo} disabled={!canRaise} onChange={e => setRaise(Number(e.target.value))} />
      <input className={styles.raiseAmountInput} aria-label="レイズ後の合計入力" type="number" inputMode="numeric" min={minRaiseTo} max={maxRaiseTo} value={raiseTo} disabled={!canRaise} onChange={e=>{const n=Number(e.target.value);if(Number.isSafeInteger(n))setRaise(Math.min(maxRaiseTo,Math.max(minRaiseTo,n)));}}/>
      <div className={styles.quickBets}>{(streetStep===0?multipliers:betPreferences.potPercentages).map((m,i) => <button type="button" key={i} disabled={!canRaise} onClick={() => setRaise(presetRaiseTo({preflop:streetStep===0,value:m,bb:bigBlind,pot:potTotal(betting),call:legal?.callAmount??0,committed:playerAt("you").committed,min:minRaiseTo,max:maxRaiseTo}))}>{m}{streetStep===0?' BB':'% POT'}</button>)}<button type="button" disabled={!canRaise} onClick={() => setRaise(maxRaiseTo)}>ALL-IN額</button></div>
      <small>{legal?.raise ? `最小 ${showChips(minRaiseTo)} ／ 最大 ${showChips(maxRaiseTo)}${legal.shortAllInOnly ? "（オールインのみ）" : ""}` : legal?.call ? "コールまたはフォールドを選択してください" : ""}</small>
      <div className={styles.actions}>
        <button type="button" disabled={!canAct || !legal?.fold} onClick={() => choose("FOLD")}>フォールド</button>
        {legal?.call?<button type="button" disabled={!canAct} onClick={() => choose("CALL")}>{legal.callAmount===playerAt("you").stack?"オールインコール":"コール"}<small>{showChips(legal.callAmount)}</small></button>:<button type="button" disabled={!canAct || !legal?.check} onClick={() => choose("CHECK")}>チェック</button>}
        <button type="button" disabled={!canRaise} onClick={() => choose("RAISE")}>{legal?.raise && raiseTo === maxRaiseTo ? "オールイン" : betting.currentBet > 0 ? "レイズ" : "ベット"}</button>
      </div>
      <div className={styles.demoFoldControls} aria-label="自動アクション予約">
        <span>自動アクション（次の自分の番に適用）</span>
        <button type="button" aria-pressed={autoChoice === "CHECK"} disabled={!handActive || !inHand("you") || handFinished || showdown} onClick={() => setAutoChoice(v => v === "CHECK" ? null : "CHECK")}>AUTO CHECK / FOLD</button>
        <button type="button" aria-pressed={autoChoice === "FOLD"} disabled={!handActive || !inHand("you") || handFinished || showdown} onClick={() => setAutoChoice(v => v === "FOLD" ? null : "FOLD")}>AUTO FOLD</button>
        <small>{autoChoice === "CHECK" ? "チェック可能ならCHECK、コールが必要ならFOLD" : autoChoice === "FOLD" ? "自分の番で自動FOLD" : "未選択（0秒でCHECKまたはFOLD）"}</small>
      </div>
      <p role="status" aria-live="polite">{bettingMessage}</p>
      <details className={styles.demoTools}><summary>デモ検証操作</summary>
      {!tournament && <div className={styles.demoFoldControls}><span>相手のフォールド確認（デモ）</span>{seats.map((seat, i) => <button type="button" key={seat.name} aria-pressed={foldedSeats.includes(i + 2)} onClick={() => setFoldedSeats(prev => prev.includes(i + 2) ? prev.filter(n => n !== i + 2) : [...prev, i + 2])}>P{i + 2} {foldedSeats.includes(i + 2) ? "復帰" : "FOLD"}</button>)}</div>}
      <div className={styles.demoSteps}><button type="button" disabled onClick={() => {}}>{streetStep === 4 ? "ショーダウン表示中" : `自動進行中：${streetNames[streetStep + 1]}`}</button><button className={styles.reset} type="button" disabled={dealing || !canStartHand || tournamentComplete} onClick={reset}>{dealing ? "配布中…" : tournamentComplete ? "大会終了" : !handActive ? "大会デモを開始" : payouts ? "次のハンド" : "デモをリセット"}</button></div>
      </details>
    </div> : <div className={styles.spectatorPanel}>観戦モード：操作ボタンは非表示です。左上の☰ → 観戦から席に戻れます。</div>}
    </div>
    {seatConfirm && <div className={styles.seatOverlay}><div className={styles.seatDialog} role="dialog" aria-modal="true" aria-labelledby="seat-confirm-title"><h2 id="seat-confirm-title">着席の確認</h2><p>この空席に着席しますか？</p><p>デモのため、実際の着席やチップ移動は行いません。</p><div className={styles.seatDialogActions}><button type="button" onClick={() => setSeatConfirm(false)}>キャンセル</button><button type="button" disabled={dealing} onClick={() => { setSpectating(false); setSeatConfirm(false); void reset(); }}>着席する</button></div></div></div>}
  </section>;
}

function Seat({ name, stack, index, active, seconds, positionLabel, lastAction, winnerGlow, seatStatus }: { name: string; stack: string; index: number; showdown: boolean; active: boolean; seconds: number; positionLabel?: string; lastAction?: string; winnerGlow?: boolean; seatStatus?: string }) {
  const progress = Math.max(0, Math.min(100, (1 - seconds / 20) * 100));
  return <div className={`${styles.seat} ${seatStatus ? styles.inactiveSeat : ""} ${active ? styles.seatActive : ""} ${winnerGlow ? styles.winnerSeat : ""}`}>
    <div className={styles.seatAvatarRow}>
      <div className={styles.seatTimerRing} style={{ background: active ? `conic-gradient(from 0deg, ${seconds <= 5 ? "#f05b58" : "#f3c663"} ${progress}%, #42586c 0)` : undefined }} aria-label={active ? `残り${seconds}秒` : undefined}><div data-pot-target={`p${index}`} data-motion-stack={`p${index}`} className={styles.avatar}><PlayerAvatar name={`PLAYER ${index}`} className={styles.memberAvatarImage}/></div></div>

      {positionLabel && <span className={styles.seatPositionBadge}>{positionLabel}</span>}
    </div>
    <span>{name}</span><small>{stack}</small>{seatStatus && <span className={styles.eliminatedTag}>{seatStatus}</span>}
    {lastAction && <span className={styles.actionBadge}>{lastAction}</span>}

  </div>;
}

/** Use the same official mark as navigation rather than a hand-drawn substitute. */
function ThumbLogo() { return <SummitMark className={styles.thumbLogo}/>; }
