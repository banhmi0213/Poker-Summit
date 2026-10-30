"use client";
import {publicAction,type ActionKind} from "@/lib/poker/action-feedback";
import {playTableEffect} from "@/lib/poker/table-effects";
import {preloadTableSamples} from "@/lib/poker/table-samples";
import {useSoundSettings} from "@/lib/poker/sound-settings";
import {TableBgmPlayer} from "@/app/poker-ui/table-bgm";
import {MobileWagerEditor} from '@/app/poker-ui/mobile-wager-editor';
import {CardFace} from '@/app/poker-ui/card-face';
import {PlayerAvatar} from '@/app/poker-ui/player-avatar';
import {useTablePreferences} from '@/app/poker-ui/table-preferences';
import {BetSizeSettings} from '@/app/poker-ui/bet-size-settings';
import {AmountInput} from '@/app/poker-ui/amount-input';
import {seOutput} from '@/lib/poker/se-output';
import {backSkin,cardSkin,skinProps,tableSkin} from '@/lib/poker/skins';
import {quickBetKind,quickBetLabel,quickBetTo,quickBetValues} from '@/lib/poker/bet-presets';
import {TableMotionLayer,useTableActionMotion} from '@/app/poker-ui/table-action-motion';
import {usePotFlight} from '@/app/poker-ui/use-pot-flight';
import {RUNOUT_STEP_MS} from '@/lib/poker/presentation-timing';
import {SummitMark} from '@/app/poker-ui/brand-mark';
import {SeatQuickBar,StampBubble} from '@/app/poker-ui/stamp-bar';
import {ExitIcon,MenuIcon} from '@/app/poker-ui/table-icons';
import type {StampId} from '@/lib/poker/stamps';

import { useEffect, useMemo, useRef, useState } from "react";
import { estimateEquity, requiredEquity } from "@/lib/poker/equity";
import { decideCpuAction, CPU_STYLES } from "@/lib/poker/cpu-strategy";
import { positionsFor, type LoggedAction, type Street } from "@/lib/poker/gto-bot";
import type { GtoReply, GtoRequest } from "@/lib/poker/gto.worker";
import { reasonText, verdictText, type GtoAdvice, type LiveDecision, type LiveReview } from "@/lib/poker/gto-review";
import styles from "./poker-table.module.css";
import { applyBettingAction, beginNextBettingStreet, createBettingRound, legalBettingActions, potTotal, type BettingRound, type BettingAction } from "@/lib/poker/betting";

import { initialTournamentPositions, nextTournamentPositions, finishTournamentHand, type TournamentOutcome, type TournamentPositions } from "@/lib/poker/tournament-table";
import { settleCompletedHand } from "@/lib/poker/hand-settlement";
import { cardLabel, handLabel, isRedCard, madeHandLabel, type DemoDeal } from "@/lib/poker/card-display";
import { carriedDemoStacks, startForcedHand, tournamentHandTerms, ringTerms, type HandTerms } from "@/lib/poker/tournament-hand";
import { tournamentClock, type PokerTournament } from "@/lib/poker/tournament";
import TournamentPanel from "@/app/poker-tournaments/clock-panel";
import { requestDemoDeal } from "./actions";
import { GtoRangeDialog } from "@/app/poker-ui/gto-range-grid";
import chartStyles from "@/app/poker-ui/gto-chart.module.css";

type Action = "FOLD" | "CHECK" | "CALL" | "RAISE";
// First think time 10s, each time bank +20s (owner 2026/10/28).
const DEMO_TURN_SECONDS = 10;
const clockwiseSeats = ["you", "p5", "p3", "p2", "p4", "p6"];
// 100BB each: the GTO CPUs play the chart solved for 100BB (owner 2026/10/27).
const initialStacks: Record<string, number> = { you: 10000, p5: 10000, p3: 10000, p2: 10000, p4: 10000, p6: 10000 };
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
  // Stamp pop (owner 2026/10/29: スタンプだした時も音出したい); set once playSound exists below.
  const stampSoundRef = useRef<(() => void) | null>(null);
  const [handStartingStacks, setHandStartingStacks] = useState<Record<string,number>>(initialHand.stacks);
  const [handFinished, setHandFinished] = useState(false);
  /** 「見せる」 after a hand (owner 2026/10/28): which of your two cards you showed this hand. */
  const [shownMine, setShownMine] = useState<number[]>([]);
  // Practice only: after a hand some CPUs that stayed to the end show one or both cards at random (owner 2026/10/28). Folded cards are mucked.
  const [cpuShows, setCpuShows] = useState<Record<string, number[]>>({});
  const [announcement,setAnnouncement]=useState<{kind:ActionKind;text:string;key:number}|null>(null);
  useEffect(()=>{if(!announcement)return;const id=setTimeout(()=>setAnnouncement(null),2600);return()=>clearTimeout(id);},[announcement]);
  const [lastActions, setLastActions] = useState<Record<string, string>>({});
  // スタンプ(2026/10/27): 練習卓でも見えるように。自分のスタンプと、ハンド後のCPUのひとこと。この画面の中だけ。
  const [demoStamps, setDemoStamps] = useState<Record<string, { stamp: StampId; key: number }>>({});
  const showStamp = (seat: string, stamp: StampId) => { setDemoStamps(prev => ({ ...prev, [seat]: { stamp, key: Date.now() + Math.random() } })); stampSoundRef.current?.(); };
  // GTO CPUs (2026/10/27): every voluntary action of the hand, for the CPUs' range reading.
  const [actionLog, setActionLog] = useState<LoggedAction[]>([]);
  const gtoWorker = useRef<Worker | null>(null), gtoRequest = useRef(0);
  useEffect(() => { let live = true; import("./gto-worker-client").then(m => { if (!live) return; try { gtoWorker.current = m.createGtoWorker(); } catch { gtoWorker.current = null; } }).catch(() => { gtoWorker.current = null; }); return () => { live = false; gtoWorker.current?.terminate(); gtoWorker.current = null; }; }, []);
  const [betting, setBetting] = useState<BettingRound>(() => initialHand.round);
  const [bettingMessage, setBettingMessage] = useState(initialHand.terms ? `SB ${initialHand.terms.sb} / BB ${initialHand.terms.bb}・Ante ${initialHand.terms.ante}を徴収しました（デモ）。` : "開始前・休憩中は強制ベットを徴収しません。開始可能になったら大会デモを開始してください。");
  const [showdown, setShowdown] = useState(false);
  // All-in with no more betting possible: cards are turned face up before the remaining board is dealt.
  const [allInReveal, setAllInReveal] = useState(false);
  const revealHoles = showdown || allInReveal;
  const [foldedSeats, setFoldedSeats] = useState<number[]>([]);
  const [streetStep, setStreetStep] = useState(0);
  const streetNames = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"] as const;
  const [mobileRaiseOpen,setMobileRaiseOpen]=useState(false);
  const [raise, setRaise] = useState((initialHand.terms?.bb ?? initialHand.round.bigBlind)*2);
  const [remaining, setRemaining] = useState(DEMO_TURN_SECONDS);
  const [timeBanksUsed, setTimeBanksUsed] = useState(0);
  // ⏰ used on the current turn only: 「延長」 and the blue ring end when the turn ends (owner 2026/10/30: 延長のマークが残ったまま).
  const [turnBanks, setTurnBanks] = useState(0);
  const timeBankSeconds = 20;
  // Time bank cards: tournaments hand out the configured number for the whole event; the practice ring gets one per hand.
  const demoTimeBankLimit = tournament ? (tournament.structure.timeBankCards ?? 2) : 1;
  const bankCardsLeft = Math.max(0, demoTimeBankLimit - timeBanksUsed);
  const [autoChoice, setAutoChoice] = useState<"CHECK" | "FOLD" | null>(null);
  const [running, setRunning] = useState(true);
  const [turnRemaining, setTurnRemaining] = useState(DEMO_TURN_SECONDS);
  const [menuOpen, setMenuOpen] = useState(false);
  const [communityOpen,setCommunityOpen]=useState(false);
  const [menuPage, setMenuPage] = useState<"settings" | "structure" | "spectate" | "exit" | "community" | "site">("settings");
  const [spectating, setSpectating] = useState(initialSpectating);
  const activePlayerId = handActive && !dealing && !handFinished && !showdown && !spectating ? betting.toAct : null;
  useTableActionMotion(tableRef,handActive?{handId:`demo-${motionHand}`,revision:0,boardCount:streetStep===0?0:streetStep===1?3:streetStep===2?4:5,settled:Boolean(payouts),players:betting.players.map(p=>({id:p.id,committed:p.committed,totalCommitted:p.totalCommitted,folded:p.folded||foldedSeats.includes(Number(p.id.slice(1)))}))}:null);
  const isYourTurn = activePlayerId === "you";
  const legal = isYourTurn ? legalBettingActions(betting, "you") : null;
  const canAct = isYourTurn && running && remaining > 0;
  useEffect(()=>{if(!canAct)setMobileRaiseOpen(false);},[canAct]);
  const minRaiseTo = legal?.minRaiseTo ?? 0;
  const maxRaiseTo = legal?.maxRaiseTo ?? 0;
  const raiseTo = legal?.raise ? Math.min(maxRaiseTo, Math.max(minRaiseTo, raise)) : 0;
  const canRaise = canAct && Boolean(legal?.raise);
  const inHand = (id:string) => betting.players.some(p=>p.id===id);
  const playerAt = (id:string) => betting.players.find(p=>p.id===id) ?? {id,stack:0,committed:0,totalCommitted:0,folded:true,allIn:false,acted:true};
  const positionFor = (id:string) => id===handPositions.sb ? "SB" : id===handPositions.bb ? "BB" : id===handPositions.sbSeat&&handPositions.sb===null ? "SB不在" : "";
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
  const [sound, setSound] = useSoundSettings(), soundEnabled = sound.se, setSoundEnabled = (se: boolean) => setSound({ se });
  soundEnabledRef.current = soundEnabled;
  // Unlock Web Audio from any genuine user gesture, including menu and action buttons.
  // Playback is synthesized locally and does not require audio assets.
  const unlockAudio = () => {
    if (typeof window === "undefined") return;
    try {
      if (!audioContextRef.current) { audioContextRef.current = new AudioContext(); preloadTableSamples(audioContextRef.current); }
      if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume();
    } catch { /* Audio is optional. */ }
  };
  type SoundKind = "turn" | "action" | "deal" | "flop" | "turnCard" | "river" | "win" | "stamp" | ActionKind;
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
        osc.connect(gain); gain.connect(seOutput(context));
        osc.start(start); osc.stop(start + duration + 0.015);
      };
      if (kind === "turnCard") {
        playTableEffect(context, "turn");
      } else if (["fold","check","call","bet","raise","allin","deal","flop","river","win","stamp"].includes(kind)) {
        playTableEffect(context, kind as ActionKind | "deal" | "flop" | "river" | "win" | "stamp");
      } else if (kind === "turn") {
        // Owner 2026/10/29: no your-turn ping.
      } else if (kind === "action") {
        tone(310, 0, 0.085, 0.085, "triangle");
      }
    } catch { /* Audio must never interrupt the game. */ }
  };
  stampSoundRef.current = () => playSound("stamp");
  useEffect(() => {
    const activate = () => {
      try {
        if (!audioContextRef.current) { audioContextRef.current = new AudioContext(); preloadTableSamples(audioContextRef.current); }
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
  const [feltColor, setFeltColor] = useState<"blue" | "green" | "black">("blue");
  const [exitConfirm, setExitConfirm] = useState(false);
  const bigBlind = betting.bigBlind;
  const quickKind = quickBetKind({preflop:streetStep===0,currentBet:betting.currentBet,bb:bigBlind}), quickSizes = quickBetValues(quickKind,betPreferences);
  const quickTo = (m:number) => quickBetTo(quickKind,{value:m,bb:bigBlind,pot:potTotal(betting),call:legal?.callAmount??0,committed:playerAt("you").committed,currentBet:betting.currentBet,min:minRaiseTo,max:maxRaiseTo});
  const tournamentComplete = Boolean(tournament && tournamentOutcome?.champion);
  const remainingIds = tournamentOutcome?.liveIds ?? betting.players.map(p=>p.id);
  const showChips = (value: number) => displayUnit === "bb" ? `${(value / bigBlind).toFixed(1)} BB` : `${value.toLocaleString()}`;
  useEffect(() => {
    if (!running || !isYourTurn || remaining === 0) return;
    const timer = window.setTimeout(() => setRemaining(t => Math.max(0, t - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [running, isYourTurn, remaining]);
  const logEntry = (round: BettingRound, after: BettingRound, id: string, a: BettingAction): LoggedAction => {
    const me = round.players.find(p => p.id === id)!, now = after.players.find(p => p.id === id)!;
    return { street: (["preflop", "flop", "turn", "river"] as Street[])[Math.min(3, streetStep)], id, type: a.type, to: now.committed, allIn: now.allIn, potBefore: potTotal(round), currentBetBefore: round.currentBet, committedBefore: me.committed };
  };
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
      const played = logEntry(betting, updated, "you", betAction);
      // ハンド後の「GTOで振り返る」用に、自分の判断をその時点の状況ごと残す（自分の手札と公開情報だけ）。
      if (!tournament && deal.holes.you) myDecisions.current.push({ view: youView(legal), played });
      setBetting(updated);setActionLog(l => [...l, played]);
      setLastActions(prev => ({ ...prev, you: automatic ? next : next === "RAISE" ? `${betAction.type.toUpperCase()} ${raiseTo}` : next }));
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
  const [rowHintOpen, setRowHintOpen] = useState(false);
  const hintBoard = deal.board.slice(0, streetStep === 0 ? 0 : streetStep === 1 ? 3 : streetStep === 2 ? 4 : 5);
  const hintOpponents = betting.players.filter(p => p.id !== "you" && !p.folded).length;
  const hint = useMemo(() => {
    if (!hintsOn || !isYourTurn || !deal.holes.you || hintOpponents < 1) return null;
    const pot = potTotal(betting), toCall = Math.min(owedForYou, playerAt("you").stack);
    return { equity: estimateEquity(deal.holes.you, hintBoard, Math.min(hintOpponents, 8), 1200).equity, required: requiredEquity(toCall, pot), toCall, pot };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintsOn, isYourTurn, deal, streetStep, hintOpponents, owedForYou, betting.currentBet]);
  /** The decision point for "you" as the GTO model sees it (own cards + public actions only). */
  const youView = (legalYou: NonNullable<ReturnType<typeof legalBettingActions>>) => {
    const live = clockwiseSeats.filter(x => betting.players.some(p => p.id === x));
    return { handKey: `demo-${motionHand}`, bb: betting.bigBlind, hero: "you", hole: deal.holes.you, board: hintBoard,
      positions: positionsFor(live, handPositions), players: betting.players.map(p => ({ id: p.id, stack: p.stack, committed: p.committed, totalCommitted: p.totalCommitted, folded: p.folded, allIn: p.allIn })),
      legal: legalYou, log: actionLog, startStacks: handStartingStacks };
  };
  // ハンド後の「GTOで振り返る」(2026/10/27): 練習卓だけ。保存はせず、この画面の中で見る。
  const myDecisions = useRef<LiveDecision[]>([]);
  const [liveRangeAt, setLiveRangeAt] = useState<number | null>(null);
  const [liveReview, setLiveReview] = useState<{status:"running"}|{status:"done";reviews:LiveReview[]}|{status:"error"}|null>(null);
  const startLiveReview = () => {
    const worker = gtoWorker.current, items = [...myDecisions.current];
    if (!worker || !items.length) { setLiveReview({ status: "error" }); return; }
    const id = ++gtoRequest.current;let done = false;
    const onReply = (e: MessageEvent<GtoReply>) => { if (e.data.id !== id || done) return; done = true; window.clearTimeout(guard); worker.removeEventListener("message", onReply); setLiveReview(e.data.type === "liveReview" ? { status: "done", reviews: e.data.reviews } : { status: "error" }); };
    const guard = window.setTimeout(() => { if (!done) { done = true; worker.removeEventListener("message", onReply); setLiveReview({ status: "error" }); } }, 60000);
    setLiveReview({ status: "running" });
    worker.addEventListener("message", onReply);
    worker.postMessage({ type: "reviewLive", id, items, budgetMs: 1500 } satisfies GtoRequest);
  };
  // GTOヒント(2026/10/27): 練習卓だけ、自分の番で「GTOならどう打つか」を割合で出す。読みは自分の手札と公開情報だけ。
  const [gtoHint, setGtoHint] = useState<{status:"running"}|{status:"done";advice:GtoAdvice}|{status:"error"}|null>(null);
  useEffect(() => {
    const worker = gtoWorker.current, legalYou = isYourTurn ? legalBettingActions(betting, "you") : null;
    if (!hintsOn || tournament || !isYourTurn || !legalYou || !deal.holes.you || !worker) { setGtoHint(null); return; }
    const id = ++gtoRequest.current, view = youView(legalYou);
    let done = false;
    const onReply = (e: MessageEvent<GtoReply>) => { if (e.data.id !== id || done) return; done = true; window.clearTimeout(guard); setGtoHint(e.data.type === "advice" ? { status: "done", advice: e.data.advice } : { status: "error" }); };
    const guard = window.setTimeout(() => { if (!done) { done = true; setGtoHint({ status: "error" }); } }, 10000);
    setGtoHint({ status: "running" });
    worker.addEventListener("message", onReply);
    worker.postMessage({ type: "advise", id, view, budgetMs: 2500 } satisfies GtoRequest);
    return () => { done = true; window.clearTimeout(guard); worker.removeEventListener("message", onReply); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintsOn, tournament, isYourTurn, betting, deal, actionLog, motionHand, handPositions, handStartingStacks, streetStep]);
  const gtoHintText = !gtoHint ? null : gtoHint.status === "running" ? "GTO：計算中…" : gtoHint.status === "error" ? "GTO：計算できませんでした" :
    gtoHint.advice.source === "none" ? `GTO：${reasonText(gtoHint.advice.reason)}` : `GTO：${gtoHint.advice.options.map(o => `${o.text} ${Math.round(o.freq * 100)}%`).join("・")}${gtoHint.advice.approx ? "（近似値）" : ""}`;
  // Auto actions never spend chips without explicit consent.
  useEffect(() => {
    if (!isYourTurn || !running || handFinished || showdown || spectating) return;
    const preferred = autoChoice === "FOLD" ? "FOLD" : owedForYou === 0 ? "CHECK" : "FOLD";
    if (remaining !== 0 && autoChoice === null) return;
    // Time ran out: a time bank card is used automatically, one at a time, before anything is folded.
    if (remaining === 0 && autoChoice === null && bankCardsLeft > 0) { setTimeBanksUsed(v => v + 1); setRemaining(timeBankSeconds); setBettingMessage(`タイムバンクカードを1枚使いました（+${timeBankSeconds}秒）`); return; }
    const timer = window.setTimeout(() => choose(preferred, true), 0);
    return () => window.clearTimeout(timer);
  }, [remaining, isYourTurn, autoChoice, owedForYou, running, handFinished, showdown, spectating, bankCardsLeft]);
  // Demo-only CPU players (2026/10/26): each decides from its own cards and the public table, with its own style.
  // In a real match the server, not the browser, will own this progression.
  useEffect(() => {
    if (!handActive || dealing || handFinished || showdown || spectating) return;
    const actorId = betting.toAct;
    if (!actorId || actorId === "you") return;
    let cancelled = false;
    const started = Date.now();
    const apply = (decision: BettingAction) => {
      if (cancelled) return;
      const player = betting.players.find(p => p.id === actorId);
      if (!player) return;
      const owed = betting.currentBet - player.committed;
      const label = decision.type === "fold" ? "FOLD" : decision.type === "check" ? "CHECK" : decision.type === "call" ? `CALL ${Math.min(owed, player.stack)}` : `${decision.type === "bet" ? "BET" : "RAISE"} ${decision.amount}`;
      const word = decision.type === "fold" ? "フォールド" : decision.type === "check" ? "チェック" : decision.type === "call" ? "コール" : decision.type === "bet" ? `ベット ${decision.amount}` : `レイズ ${decision.amount}`;
      try {
        const next = applyBettingAction(betting, actorId, decision);
        setBetting(next);setActionLog(l => [...l, logEntry(betting, next, actorId, decision)]);
        setLastActions(prev => ({ ...prev, [actorId]: label }));
        const cue=publicAction(betting.players,next.players,actorId);
        if(cue){playSound(cue.kind);setAnnouncement({kind:cue.kind,text:`PLAYER ${actorId.slice(1)} · ${cue.label}${cue.amount?` ${showChips(cue.amount)}`:""}`,key:Date.now()});}
        setBettingMessage(`PLAYER ${actorId.slice(1)}：${word}（CPU）`);
      } catch (error) {
        setBettingMessage(error instanceof Error ? error.message : "自動操作に失敗しました");
      }
    };
    // Equity CPU: used when the GTO worker is unavailable or fails (cpuMode='calling' is the progression test only).
    const simple = (): BettingAction => {
      const player = betting.players.find(p => p.id === actorId)!, owed = betting.currentBet - player.committed, legal = legalBettingActions(betting, actorId);
      const cpuStyles: Record<string, keyof typeof CPU_STYLES> = { p2: "standard", p3: "tight", p4: "loose", p5: "aggressive", p6: "standard" };
      const board = deal.board.slice(0, streetStep === 0 ? 0 : streetStep === 1 ? 3 : streetStep === 2 ? 4 : 5);
      return cpuMode !== "calling" && legal && deal.holes[actorId] ? decideCpuAction({
        hole: deal.holes[actorId], board, pot: potTotal(betting), toCall: legal.callAmount, stack: player.stack, committed: player.committed,
        currentBet: betting.currentBet, bigBlind: betting.bigBlind, legal,
        opponents: betting.players.filter(p => p.id !== actorId && !p.folded).length,
        playersBehind: betting.players.filter(p => p.id !== actorId && !p.folded && !p.allIn && !p.acted).length,
        isBigBlind: handPositions.bb === actorId,
        maxOpponentStack: Math.max(0, ...betting.players.filter(p => p.id !== actorId && !p.folded).map(p => p.stack + p.committed)),
      }, CPU_STYLES[cpuStyles[actorId] ?? "standard"]) : (owed > 0 ? { type: "call" } : { type: "check" });
    };
    const worker = gtoWorker.current, legal = legalBettingActions(betting, actorId);
    // 練習卓のCPUはGTO通りに打つ（プリフロップ表・フロップの事前計算・ターンとリバーはその場で計算）。読みは自分の手札と公開情報だけ。
    if (worker && cpuMode !== "calling" && legal && deal.holes[actorId]) {
      const id = ++gtoRequest.current, live = clockwiseSeats.filter(x => betting.players.some(p => p.id === x));
      const view = { handKey: `demo-${motionHand}`, bb: betting.bigBlind, hero: actorId, hole: deal.holes[actorId], board: deal.board.slice(0, streetStep === 0 ? 0 : streetStep === 1 ? 3 : streetStep === 2 ? 4 : 5),
        positions: positionsFor(live, handPositions), players: betting.players.map(p => ({ id: p.id, stack: p.stack, committed: p.committed, totalCommitted: p.totalCommitted, folded: p.folded, allIn: p.allIn })),
        legal, log: actionLog, startStacks: handStartingStacks };
      const onReply = (e: MessageEvent<GtoReply>) => {
        worker.removeEventListener("message", wrapped);
        const decision = e.data.type === "decision" ? e.data.decision.action : simple();
        window.setTimeout(() => apply(decision), Math.max(0, 650 - (Date.now() - started)));
      };
      // A worker that fails to load or hangs must not freeze the table: decide with the equity CPU instead.
      let settled = false;
      const giveUp = () => { if (settled) return; settled = true; worker.removeEventListener("message", onReply); worker.removeEventListener("error", giveUp); apply(simple()); };
      const guard = window.setTimeout(giveUp, 8000);
      const first = onReply;
      const wrapped = (e: MessageEvent<GtoReply>) => { if (e.data.id !== id || settled) return; settled = true; window.clearTimeout(guard); worker.removeEventListener("error", giveUp); first(e); };
      worker.addEventListener("message", wrapped);
      worker.addEventListener("error", giveUp);
      worker.postMessage({ type: "decide", id, view, budgetMs: 2500 } satisfies GtoRequest);
      return () => { cancelled = true; settled = true; window.clearTimeout(guard); worker.removeEventListener("message", wrapped); worker.removeEventListener("error", giveUp); };
    }
    const timer = window.setTimeout(() => apply(simple()), 650);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [betting, handFinished, showdown, spectating, dealing, handActive, deal, streetStep, handPositions, cpuMode, actionLog, motionHand, handStartingStacks]);

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
        {
          const dealt = betting.players.filter(p => p.id !== "you" && !p.folded && !foldedSeats.includes(Number(p.id.slice(1))) && deal.holes[p.id]); // folded cards are mucked and cannot be shown
          const picks: Record<string, number[]> = {};
          for (const p of dealt) if (Math.random() < 0.5) picks[p.id] = Math.random() < 0.5 ? [0, 1] : [Math.random() < 0.5 ? 0 : 1];
          if (!Object.keys(picks).length && dealt.length) { const p = dealt[Math.floor(Math.random() * dealt.length)]; picks[p.id] = Math.random() < 0.5 ? [0, 1] : [Math.random() < 0.5 ? 0 : 1]; }
          setCpuShows(picks);
        }
        // CPUs sometimes react after the hand (practice only): the winner thanks, someone who lost a big pot sighs.
        if (Math.random() < 0.45) {
          const cpus = betting.players.filter(p => p.id !== "you"), winners = cpus.filter(p => (result.payouts[p.id] ?? 0) > 0), losers = cpus.filter(p => !p.folded && !(result.payouts[p.id] ?? 0));
          const pickOne = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
          const who = winners.length && (Math.random() < 0.6 || !losers.length) ? { id: pickOne(winners).id, stamps: ["thanks", "nice", "nobluff"] as StampId[] } : losers.length ? { id: pickOne(losers).id, stamps: (result.showdown ? ["river", "gotme", "read", "burning", "tilt"] : ["gotme", "nicefold"]) as StampId[] } : null;
          if (who) window.setTimeout(() => showStamp(who.id, pickOne(who.stamps)), 900);
        }
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
      setRemaining(DEMO_TURN_SECONDS);setTurnBanks(0);
      setRunning(true);
      setBettingMessage(`${streetNames[nextStep]}：次のベットラウンドです（自動デモ）`);
    }, RUNOUT_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [betting, handFinished, showdown, spectating, streetStep, buttonIndex, deal, dealing, handActive, handPositions, tournament, handTerms, handStartingStacks, tournamentOutcome]);

  useEffect(() => {
    if (handActive && betting.toAct === "you" && !handFinished && !showdown && !spectating) {
      setRemaining(DEMO_TURN_SECONDS);setTurnBanks(0);
      setRunning(true);
      setAction(null);
    }
  }, [betting.toAct, handFinished, showdown, spectating, handActive]);

  useEffect(() => {
    setTurnRemaining(DEMO_TURN_SECONDS);
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
    // Ring demo: only a player who went bust buys back in; everyone else keeps what they won.
    const refilled=tournament?[]:Object.keys(carried).filter(id=>carried[id]<=0);
    const startingStacks=tournament?carried:Object.fromEntries(Object.entries(carried).map(([id,stack])=>[id,stack>0?stack:initialStacks[id]]));
    const live=clockwiseSeats.filter(id=>(startingStacks[id]??0)>0);
    if(live.length<2){setBettingMessage("大会終了：優勝が確定しました。");return;}
    const nextPos=handActive?(tournament?nextTournamentPositions(clockwiseSeats,live,handPositions):initialTournamentPositions(clockwiseSeats,live,clockwiseSeats[(buttonIndex+1)%clockwiseSeats.length])):handPositions;
    const nextButton=clockwiseSeats.indexOf(nextPos.button);
    setDealing(true);
    try {
      const nextDeal=await requestDemoDeal(nextButton,live);
      const nextRound=makeHand(startingStacks,nextButton,terms,nextPos);
      // Clear the previous reveal/awards before changing the participating roster.
      setPayouts(null);setCpuShows({});setShowdown(false);setAllInReveal(false);setStreetStep(0);
      setHandStartingStacks(Object.fromEntries(live.map(id=>[id,startingStacks[id]])));setHandTerms(terms);setHandActive(true);setHandPositions(nextPos);
      setDeal(nextDeal);setMotionHand(v=>v+1);setButtonIndex(nextButton);setBetting(nextRound);setPayouts(null);setCpuShows({});
      setLastActions({});setActionLog([]);setDemoStamps({});setShownMine([]);myDecisions.current=[];setLiveReview(null);setLiveRangeAt(null);setTurnRemaining(DEMO_TURN_SECONDS);setHandFinished(false);
      setBettingMessage(`新しいカードを配布。${tournament?`残り${live.length}人・LV${terms.level}・`:""}SB ${terms.sb} / BB ${terms.bb}・Ante ${terms.ante}を徴収しました。${nextPos.sb===null?"SBは不在のため未徴収。":""}${refilled.length?`${refilled.map(id=>id==="you"?"あなた":`PLAYER ${id.slice(1)}`).join("・")}の残高が0になったため補充しました。`:""}`);
      setFoldedSeats([]);setStreetStep(0);setShowdown(false);setAllInReveal(false);setAction(null);
      setAutoChoice(null);setRaise(terms.bb*2);setRemaining(DEMO_TURN_SECONDS);setTurnBanks(0);if(!tournament)setTimeBanksUsed(0);setRunning(true);
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
      <span>{displayUnit === "bb" ? `${(p.committed / bigBlind).toFixed(1)} BB` : p.committed.toLocaleString()}</span>
    </div>;
  };
  return <section className={`${styles.shell} ${styles.demoShell}`} aria-label="ポーカーテーブルのデザイン試作"><TableBgmPlayer/>
    <div className={styles.heading}>
      <button type="button" className={styles.menuToggle} aria-label="ゲームメニューを開く" aria-expanded={menuOpen} aria-controls="poker-game-menu" onClick={() => setMenuOpen(v => !v)}><MenuIcon/></button>
      <span>POKER SUMMIT · TEXAS HOLD'EM</span>
      <button type="button" className={styles.topExit} aria-label="ゲームを退出" onClick={() => { setMenuPage("exit"); setExitConfirm(true); setMenuOpen(true); }}><ExitIcon/></button>
    </div>
    {menuOpen && <div className={styles.menuBackdrop} aria-hidden="true" onClick={() => setMenuOpen(false)} />}
    <div id="poker-game-menu" className={styles.menuPanel} hidden={!menuOpen}>
      <div className={styles.menuTop}><strong>ゲームメニュー</strong><button type="button" aria-label="メニューを閉じる" onClick={() => setMenuOpen(false)}>×</button></div>
      <nav className={styles.menuNav} aria-label="ゲームメニュー">
        <button type="button" className={menuPage === "settings" ? styles.menuSelected : ""} onClick={() => setMenuPage("settings")}>⚙ 設定</button>
        <button type="button" className={menuPage === "structure" ? styles.menuSelected : ""} onClick={() => setMenuPage("structure")}>テーブル情報</button>
        <button type="button" className={menuPage === "community" ? styles.menuSelected : ""} onClick={() => setMenuPage("community")}>サミット</button>
        <button type="button" className={menuPage === "site" ? styles.menuSelected : ""} onClick={() => setMenuPage("site")}>サイト</button>
        <button type="button" className={menuPage === "spectate" ? styles.menuSelected : ""} disabled={gameType === "tournament"} onClick={() => setMenuPage("spectate")}>◉ 観戦</button>
        <button type="button" className={menuPage === "exit" ? styles.menuSelected : ""} onClick={() => { setMenuPage("exit"); setExitConfirm(false); }}>退出</button>
      </nav>
      <div className={styles.menuContent}>
        {menuPage === "settings" && <div className={styles.menuFields}>
          <h2>設定</h2>
          <label>BB表示 <input type="checkbox" checked={displayUnit === "bb"} onChange={e => setDisplayUnit(e.target.checked ? "bb" : "chips")} /></label>
          <label>効果音 <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} /></label>
          <label>効果音の音量 <input type="range" aria-label="効果音の音量" min={0} max={100} step={5} value={sound.seVolume} disabled={!soundEnabled} onChange={e => setSound({ seVolume: Number(e.target.value) })} /> <small>{sound.seVolume}</small></label>
          <label>BGM <input type="checkbox" checked={sound.bgm} onChange={e => setSound({ bgm: e.target.checked })} /></label>
          <label>BGMの音量 <input type="range" aria-label="BGMの音量" min={0} max={100} step={5} value={sound.bgmVolume} disabled={!sound.bgm} onChange={e => setSound({ bgmVolume: Number(e.target.value) })} /> <small>{sound.bgmVolume}</small></label>
          <label>練習ヒント（勝率の目安・GTO） <input type="checkbox" checked={hintsOn} onChange={e => setHintsOn(e.target.checked)} /></label>
          <p>レイズ額の設定</p>
          <BetSizeSettings/>
          <small>BB表示と倍率はデモに反映。効果音は各場面で再生されます。レイズ額の設定は会員ごとに保存できます。</small>
        </div>}
        {menuPage === "structure" && <div className={styles.menuFields}>{tournament?<TournamentPanel tournament={tournament} serverNow={serverNow} mode="structure"/>:<><h2>リングテーブル情報</h2><p>SB 50 / BB 100</p><p>6人卓・テキサスホールデム</p><p>デモでは退出予約・精算は発生しません。</p></>}</div>}
        {menuPage === "community" && <div className={styles.menuFields}><h2>サミット連携</h2><section><h3>チップ残高</h3><p>デモの持ち点と会員の残高は別です。</p><a href="/mypage/chips" target="_blank" rel="noreferrer">会員のチップ残高・付与履歴を確認 ↗</a></section><details onToggle={e=>setCommunityOpen(e.currentTarget.open)}><summary>掲示板を開く</summary>{communityOpen&&<iframe title="サミット掲示板" src="/poker-community" style={{width:"100%",height:"55dvh",border:"1px solid #9b8354",borderRadius:8}}/>}</details></div>}
        {menuPage === "site" && <div className={styles.menuFields}><h2>サイト</h2><p>プレイ画面を残して別タブで開きます。</p><p><a href="/" target="_blank" rel="noreferrer">Poker Summit トップ ↗</a></p><p><a href="/poker-lobby" target="_blank" rel="noreferrer">ポーカーロビー ↗</a></p><p><a href="/mypage" target="_blank" rel="noreferrer">マイページ ↗</a></p></div>}
        {menuPage === "spectate" && <div className={styles.menuFields}><h2>観戦（リングゲーム）</h2><p>席を離れてもテーブル画面はそのまま表示します。</p><button type="button" onClick={() => { setSpectating(v => !v); setMenuOpen(false); setRunning(false); setSeatConfirm(false); }}>{spectating ? "デモの席に戻る" : "席を離れて観戦する"}</button><small>デモ表示のみ。実際のチップ精算や観戦通信は行いません。</small></div>}
        {menuPage === "exit" && <div className={styles.menuFields}><h2>退出</h2><p>ゲーム画面を終了しますか？（デモのためチップ精算はありません）</p>{!exitConfirm && <button type="button" onClick={() => setExitConfirm(true)}>退出する</button>}{exitConfirm && <><button type="button" onClick={() => { window.location.assign("/poker-lobby"); }}>退出してロビーへ</button><button type="button" onClick={() => setExitConfirm(false)}>キャンセル</button></>}</div>}
      </div>
    </div>
    <details className={styles.demoInfo}><summary>デモについて</summary><h1>オンラインポーカー テーブル試作</h1><p>チップと進行はブラウザ内のデモです。会員残高とは連携していません。</p></details>

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
    <div ref={tableRef} className={styles.table} onPointerDown={unlockAudio} data-felt={feltColor} {...(skinProps(tableSkin(betPreferences.tableSkin),cardSkin(betPreferences.cardSkin),backSkin(betPreferences.backSkin)) as Record<string,unknown>)} data-showdown={showdown ? "true" : "false"} data-reveal-hands={revealHoles || Boolean(payouts && Object.keys(cpuShows).length)} data-street={streetStep}><TableMotionLayer/>
      {payouts && !awardAnimationDone && <div className={styles.awardAnimationLayer} aria-hidden="true">
        {awardWinners.map(id => <div key={id} data-pot-winner={id} className={`${styles.awardFlight} ${awardDestinations[id]}`}>
          <span data-pot-coin className={styles.awardCoin}>♠</span><span data-pot-coin className={styles.awardCoin}>♠</span><span data-pot-coin className={styles.awardCoin}>♠</span>
          <b className={styles.awardAmount}>+{payouts[id].toLocaleString()}</b>
        </div>)}
      </div>}
      <div className={styles.topSeats}><Seat {...seats[0]} stamp={demoStamps["p2"]} stack={displayStack("p2")} index={2} winnerGlow={Boolean(payouts?.p2)} showdown={showdown} active={activePlayerId === "p2"} seconds={turnRemaining} seatStatus={seatStatus("p2")} positionLabel={positionFor("p2")} dealer={handActive&&handPositions.button==="p2"} lastAction={lastActions["p2"]} folded={handActive && (foldedSeats.includes(2) || playerAt("p2").folded)} allIn={handActive && playerAt("p2").allIn} />{streetBet("p2")}</div>
      <div className={styles.edgeSeatThree}><Seat {...seats[1]} stamp={demoStamps["p3"]} stack={displayStack("p3")} index={3} winnerGlow={Boolean(payouts?.p3)} showdown={showdown} active={activePlayerId === "p3"} seconds={turnRemaining} seatStatus={seatStatus("p3")} positionLabel={positionFor("p3")} dealer={handActive&&handPositions.button==="p3"} lastAction={lastActions["p3"]} folded={handActive && (foldedSeats.includes(3) || playerAt("p3").folded)} allIn={handActive && playerAt("p3").allIn} /></div>
      <div className={styles.edgeSeatFour}><Seat {...seats[2]} stamp={demoStamps["p4"]} stack={displayStack("p4")} index={4} winnerGlow={Boolean(payouts?.p4)} showdown={showdown} active={activePlayerId === "p4"} seconds={turnRemaining} seatStatus={seatStatus("p4")} positionLabel={positionFor("p4")} dealer={handActive&&handPositions.button==="p4"} lastAction={lastActions["p4"]} folded={handActive && (foldedSeats.includes(4) || playerAt("p4").folded)} allIn={handActive && playerAt("p4").allIn} /></div>
      <div className={styles.opponentCardsLayer} aria-label="各プレイヤーのハンド（ショーダウンまでは裏向き）">
        {seats.map((seat, i) => { const id = `p${i + 2}`, folded = foldedSeats.includes(i + 2) || playerAt(id).folded, shown = payouts ? cpuShows[id] ?? [] : []; return (!handActive || !deal.holes[id] || (folded && !shown.length)) ? null : <div key={seat.name} className={`${styles.showdownPosition} ${[styles.showdownTwo, styles.showdownThree, styles.showdownFour, styles.showdownFive, styles.showdownSix][i]}`} data-shown={shown.length && !(revealHoles && !folded) ? true : undefined}>
          {showdown && !folded && <strong className={styles.handRank}>{handLabel(deal.holes[id], deal.board)}</strong>}
          <div className={styles.miniCards} data-motion-hole={`p${i+2}`}>{deal.holes[id].map((card, j) => (revealHoles && !folded) || shown.includes(j)
            ? <span key={j} className={isRedCard(card) ? styles.redCard : ""}><CardFace card={card}/></span>
            : <span key={j} className={styles.cardBack} aria-label="Poker Summitの親指ロゴ入り裏向きカード"><ThumbLogo /></span>)}</div>
        </div>; })}
      </div>
      <div className={styles.streetBets} aria-label="各席のベット額">
        {clockwiseSeats.filter(id => id !== "p2").map(streetBet)}
        {/* Dealer button on the felt in front of the button seat; it moves to the next seat every hand. */}
        {handActive && <span key={handPositions.button} className={`${styles.dealerSpot} ${styles[`bet_${handPositions.button}`]}`} data-dealer-seat={handPositions.button}><span className={styles.dealerButton} aria-label="ディーラーボタン">D</span></span>}
      </div>
      {announcement&&<div key={announcement.key} className={styles.actionToast} data-kind={announcement.kind} role="status" aria-live="polite">{announcement.text}</div>}
      <div className={styles.felt}>
        <div data-pot-source className={styles.pot}>ポット <strong>{showChips(potTotal(betting))}</strong>{(()=>{const t=handTerms??(gameType==="ring"?ringTerms:null);return t&&<small className={styles.blindsInfo} aria-label="ブラインド">{tournament&&t.level?`LV${t.level}・`:""}ブラインド {t.sb.toLocaleString()}/{t.bb.toLocaleString()}{t.ante?`・アンティ ${t.ante.toLocaleString()}`:""}</small>;})()}</div>
        <div className={styles.cards} aria-label="共通カード" data-motion-board>{deal.board.slice(0, streetStep === 0 ? 0 : streetStep === 1 ? 3 : streetStep === 2 ? 4 : 5).map((card, i) => <span key={i} className={isRedCard(card) ? styles.red : ""}><CardFace card={card}/></span>)}</div>
        <div className={styles.street}>{streetNames[streetStep]}</div>
      </div>
      <div className={styles.edgeSeatFive}><Seat {...seats[3]} stamp={demoStamps["p5"]} stack={displayStack("p5")} index={5} winnerGlow={Boolean(payouts?.p5)} showdown={showdown} active={activePlayerId === "p5"} seconds={turnRemaining} seatStatus={seatStatus("p5")} positionLabel={positionFor("p5")} dealer={handActive&&handPositions.button==="p5"} lastAction={lastActions["p5"]} folded={handActive && (foldedSeats.includes(5) || playerAt("p5").folded)} allIn={handActive && playerAt("p5").allIn} /></div>
      <div className={styles.edgeSeatSix}><Seat {...seats[4]} stamp={demoStamps["p6"]} stack={displayStack("p6")} index={6} winnerGlow={Boolean(payouts?.p6)} showdown={showdown} active={activePlayerId === "p6"} seconds={turnRemaining} seatStatus={seatStatus("p6")} positionLabel={positionFor("p6")} dealer={handActive&&handPositions.button==="p6"} lastAction={lastActions["p6"]} folded={handActive && (foldedSeats.includes(6) || playerAt("p6").folded)} allIn={handActive && playerAt("p6").allIn} /></div>
      {spectating && <div className={styles.spectatorSeat}><button type="button" className={styles.seatPlus} aria-label="空席に着席する" onClick={() => setSeatConfirm(true)}>＋</button><span>空席 · 着席可能</span></div>}
      {!spectating && <div className={styles.self}><div className={`${styles.activeAvatar} ${isYourTurn ? styles.turnActive : ""} ${payouts?.you ? styles.winnerGlow : ""}`} role="progressbar" aria-label="あなたのターン 残り時間" aria-valuemin={0} aria-valuemax={DEMO_TURN_SECONDS + timeBanksUsed * timeBankSeconds} aria-valuenow={remaining} data-extended={isYourTurn && timeBanksUsed > 0 ? true : undefined} style={{ background: `conic-gradient(from 0deg, ${timeBanksUsed > 0 ? "#5ab0ff" : remaining <= 5 ? "#f05b58" : "#f3c663"} ${Math.max(0, Math.min(100, (1 - remaining / (DEMO_TURN_SECONDS + timeBanksUsed * timeBankSeconds)) * 100))}%, #42586c 0)` }}><div data-pot-target="you" data-motion-stack="you" className={styles.avatar}><PlayerAvatar url={member.avatarUrl} name={member.displayName} className={styles.memberAvatarImage}/>{handActive && action === "FOLD" && <span className={styles.seatFold} aria-hidden="true">FOLD</span>}</div>{demoStamps.you && <StampBubble key={demoStamps.you.key} stamp={demoStamps.you.stamp}/>}</div><div className={styles.selfInfo}><SeatQuickBar onStamp={id => showStamp("you", id)} clock={isYourTurn && running && bankCardsLeft > 0 ? <button type="button" aria-label={`タイムバンクカード${bankCardsLeft}枚`} title="タップで延長" className={styles.clockMark} onClick={() => { setTimeBanksUsed(v => v + 1); setTurnBanks(v => v + 1); setRemaining(r => r + timeBankSeconds); setBettingMessage(`タイムバンクカードを1枚使いました（+${timeBankSeconds}秒）`); }}>⏰<b>{bankCardsLeft}</b></button> : <span className={styles.clockMark} aria-label={`タイムバンクカード${bankCardsLeft}枚`}>⏰<b>{bankCardsLeft}</b></span>}/>{(() => { const k = handActive && action !== "FOLD" ? seatActionKind(lastActions.you, playerAt("you").allIn, false) : null; return k && <div className={styles.seatAct} data-kind={k}><b key={lastActions.you}>{k === "allin" ? "ALL-IN" : k === "bet" ? (lastActions.you?.startsWith("BET") ? "BET" : "RAISE") : k.toUpperCase()}</b></div>; })()}{seatStatus("you") && <span className={styles.eliminatedTag}>{seatStatus("you")}</span>}<span className={styles.nameRow}>{isYourTurn && timeBanksUsed > 0 ? <b className={styles.extTag}>延長</b> : <strong className={styles.memberName} title={member.displayName}>{member.displayName}</strong>}</span>{(() => { const chips = String(showChips(playerAt("you").stack + (payouts?.you ?? 0))); return <small data-len={chips.length}>{chips}</small>; })()}{handActive && inHand("you") && action !== "FOLD" && !showdown && (() => { const made = madeHandLabel(deal.holes.you, hintBoard); return made && <em className={styles.madeHand}>{made}</em>; })()}</div>{handActive && inHand("you") && deal.holes.you && action !== "FOLD" && <div className={styles.handWithRank}>{showdown && <strong className={styles.handRank}>{handLabel(deal.holes.you, deal.board)}</strong>}{payouts ? <div className={styles.hole} data-motion-hole="you" data-show-hole>{deal.holes.you.map((card, i) => <span key={i} role="button" tabIndex={shownMine.includes(i) ? -1 : 0} className={`${isRedCard(card) ? styles.redCard : styles.blackCard} ${styles.showCard}`} data-shown={shownMine.includes(i) || undefined} aria-pressed={shownMine.includes(i)} aria-disabled={shownMine.includes(i) || undefined} aria-label={shownMine.includes(i) ? "見せています" : "タップで見せる"} onClick={() => setShownMine(prev => prev.includes(i) ? prev : [...prev, i])} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShownMine(prev => prev.includes(i) ? prev : [...prev, i]); } }}><CardFace card={card}/></span>)}<small className={styles.showHint}>{shownMine.length === 2 ? "2枚見せています" : shownMine.length ? "もう1枚タップで2枚見せる" : "タップで見せる"}</small></div> : <div className={styles.hole} data-motion-hole="you">{deal.holes.you.map((card, i) => <span key={i} className={isRedCard(card) ? styles.redCard : styles.blackCard}><CardFace card={card}/></span>)}</div>}</div>}</div>}
    </div>
    <div className={styles.actionColumn}>
      {<div className={`${styles.resultOverlay} ${showCurrentResult?"":styles.previousResult}`} role="status" aria-live="polite">
        <strong>{showCurrentResult?`🏆 ${winningPlayers.map(p=>p.name).join("・")} がPOT獲得`:lastHandResult?`前ハンド：${lastHandResult.winners.join("・")} がPOT獲得`:"ハンド結果：確定待ち"}</strong>
        <div className={styles.resultDeltas}>{boardRows.map(p => <span key={p.id} className={p.delta > 0 ? styles.resultGain : p.delta < 0 ? styles.resultLoss : styles.resultEven}>{p.name} <b>{p.delta > 0 ? "+" : ""}{p.delta.toLocaleString()}</b></span>)}</div>
      </div>}
    {!spectating ? <div className={styles.controls} role="region" aria-label="操作パネル" data-turn={isYourTurn && running ? (remaining <= 5 ? "urgent" : "on") : undefined}>
      {mobileRaiseOpen && canRaise && <MobileWagerEditor amount={raiseTo} min={minRaiseTo} max={maxRaiseTo} step={bigBlind} format={showChips} label={raiseTo===maxRaiseTo?'オールイン':betting.currentBet>0?'レイズ':'ベット'} onChange={setRaise} onClose={()=>setMobileRaiseOpen(false)} onConfirm={()=>{setMobileRaiseOpen(false);choose("RAISE");}} presets={[...quickSizes.map(m=>({label:quickBetLabel(quickKind,m),amount:quickTo(m)})),{label:'ALL-IN額',amount:maxRaiseTo}]}/>}

      <div className={styles.turnHeader}><div className={styles.turn}>{tournamentComplete ? "大会終了" : !handActive ? "ハンド開始待ち" : !inHand("you") ? "脱落・進行確認中" : isYourTurn ? "あなたの番" : handFinished || showdown ? "ハンド終了" : `PLAYER ${activePlayerId?.slice(1) ?? "—"}の番`} · <strong aria-label={`残り${remaining}秒`}>{remaining}秒</strong></div></div>

      {hint && <details className={styles.phoneHint}><summary>ヒント</summary><p>{hint.toCall>0?`必要勝率 ${Math.round(hint.required*100)}% ／ `:''}推定勝率 {Math.round(hint.equity*100)}%</p>{gtoHintText && <p data-gto-hint>{gtoHintText}</p>}<small>相手の手札をランダムと仮定した目安</small></details>}
      {hint && <p className={styles.hint} role="note">{hint.toCall > 0 ? <>必要勝率 <b>{Math.round(hint.required * 100)}%</b>（{hint.toCall.toLocaleString()}をコールしてPOT {(hint.pot + hint.toCall).toLocaleString()}）・</> : null}推定勝率 <b>{Math.round(hint.equity * 100)}%</b><small>相手の手札をランダムと仮定した目安</small>{gtoHintText && <span data-gto-hint style={{display:"block"}}>{gtoHintText}</span>}</p>}
      <label htmlFor="poker-demo-raise">{betting.currentBet > 0 ? "レイズ後の合計額" : "ベット額"}: {legal?.raise ? showChips(raiseTo) : "—"}</label>
      <input aria-label="レイズ額スライダー" id="poker-demo-raise" type="range" min={minRaiseTo} max={maxRaiseTo} step={1} value={raiseTo} disabled={!canRaise} onChange={e => setRaise(Number(e.target.value))} />
      <AmountInput className={styles.raiseAmountInput} ariaLabel="レイズ後の合計入力" value={raiseTo} min={minRaiseTo} max={maxRaiseTo} disabled={!canRaise} onChange={setRaise}/>
      <div className={styles.quickBets}>{quickSizes.map((m,i) => <button type="button" key={i} disabled={!canRaise} onClick={() => setRaise(quickTo(m))}>{quickBetLabel(quickKind,m)}</button>)}<button type="button" disabled={!canRaise} onClick={() => setRaise(maxRaiseTo)}>ALL-IN額</button></div>
      <small>{legal?.raise ? `最小 ${showChips(minRaiseTo)} ／ 最大 ${showChips(maxRaiseTo)}${legal.shortAllInOnly ? "（オールインのみ）" : ""}` : legal?.call ? "コールまたはフォールドを選択してください" : ""}</small>
      <div className={styles.actions}>
        <button type="button" disabled={!canAct || !legal?.fold} onClick={() => choose("FOLD")}>フォールド</button>
        {legal?.call?<button type="button" disabled={!canAct} onClick={() => choose("CALL")}>{legal.callAmount===playerAt("you").stack?"オールインコール":"コール"}<small>{showChips(legal.callAmount)}</small></button>:<button type="button" disabled={!canAct || !legal?.check} onClick={() => choose("CHECK")}>チェック</button>}
        <button type="button" disabled={!canRaise} onClick={() => {if(typeof window!=="undefined"&&typeof window.matchMedia==="function"&&window.matchMedia("(max-width:899px)").matches){if(mobileRaiseOpen){setMobileRaiseOpen(false);choose("RAISE");}else setMobileRaiseOpen(true);}else choose("RAISE");}}>{legal?.raise && raiseTo === maxRaiseTo ? "オールイン" : betting.currentBet > 0 ? "レイズ" : "ベット"}{mobileRaiseOpen&&<small>{showChips(raiseTo)}</small>}</button>
      </div>
      <div className={styles.demoFoldControls} aria-label="自動アクション予約">
        <span>自動アクション（次の自分の番に適用）</span>
        <button type="button" aria-pressed={autoChoice === "CHECK"} disabled={!handActive || !inHand("you") || handFinished || showdown} onClick={() => setAutoChoice(v => v === "CHECK" ? null : "CHECK")}>AUTO CHECK / FOLD</button>
        <button type="button" aria-pressed={autoChoice === "FOLD"} disabled={!handActive || !inHand("you") || handFinished || showdown} onClick={() => setAutoChoice(v => v === "FOLD" ? null : "FOLD")}>AUTO FOLD</button>
        {/* Phone (owner 2026/10/28): seconds beside AUTO FOLD instead of the header line; the hint opens from here. */}
        <b className={styles.DEMO_TURN_SECONDS} data-urgent={isYourTurn && remaining <= 5 ? "" : undefined} aria-label={isYourTurn ? `残り${remaining}秒` : undefined}>{isYourTurn ? `残り ${remaining}秒` : handFinished || showdown ? "ハンド終了" : activePlayerId ? `PLAYER ${activePlayerId.slice(1)}の番` : ""}</b>
        {hint && <button type="button" className={styles.rowHintToggle} aria-expanded={rowHintOpen} onClick={() => setRowHintOpen(v => !v)}>ヒント</button>}
        {hint && rowHintOpen && <div className={styles.rowHint} role="note"><p>{hint.toCall>0?`必要勝率 ${Math.round(hint.required*100)}% ／ `:''}推定勝率 {Math.round(hint.equity*100)}%</p>{gtoHintText && <p data-gto-hint>{gtoHintText}</p>}<small>相手の手札をランダムと仮定した目安</small></div>}
        <small>{autoChoice === "CHECK" ? "チェック可能ならCHECK、コールが必要ならFOLD" : autoChoice === "FOLD" ? "自分の番で自動FOLD" : "未選択（0秒でCHECKまたはFOLD）"}</small>
      </div>
      <p role="status" aria-live="polite">{bettingMessage}</p>
      {!tournament && handFinished && myDecisions.current.length > 0 && <div className={styles.gtoReview} aria-label="GTOで振り返る">
        {!liveReview && <button type="button" onClick={startLiveReview}>GTOで振り返る</button>}
        {liveReview?.status === "running" && <p role="status">GTOを計算中…（数秒かかります）</p>}
        {liveReview?.status === "done" && <small>GTOの判定は改良中です（SBのリンプ・スクイーズ・3人以上のポットは今後対応）。</small>}
        {liveReview?.status === "error" && <><p role="alert">GTOの計算に失敗しました。</p><button type="button" onClick={startLiveReview}>もう一度</button></>}
        {liveReview?.status === "done" && <ol>{liveReview.reviews.map((r, i) => <li key={i}>
          <em>{({ preflop: "プリフロップ", flop: "フロップ", turn: "ターン", river: "リバー" } as const)[r.street]}</em> あなた：{r.played}
          {r.source === "none" ? <small>GTO：{reasonText(r.reason)}</small> : <>{r.verdict && <b data-verdict={r.verdict}>{verdictText[r.verdict]}{r.freq !== null ? ` ${Math.round(r.freq * 100)}%` : ""}</b>}<small>GTO：{r.options.map(o => `${o.text} ${Math.round(o.freq * 100)}%`).join("・")}{r.approx ? "（近似値：4人以上のポット・採点なし）" : r.freq === null ? "（この打ち方は表にありません）" : ""}{r.range && <button type="button" className={chartStyles.rangeToggle} aria-expanded={liveRangeAt === i} onClick={() => setLiveRangeAt(liveRangeAt === i ? null : i)}>{liveRangeAt === i ? "レンジ表を閉じる" : "レンジ表"}</button>}</small>{liveRangeAt === i && r.range && <GtoRangeDialog range={r.range} who="あなた" title={`${({ preflop: "プリフロップ", flop: "フロップ", turn: "ターン", river: "リバー" } as const)[r.street]}：${r.played}のときのレンジ表`} onClose={() => setLiveRangeAt(null)} />}</>}
        </li>)}</ol>}
      </div>}
      <details className={styles.demoTools}><summary>デモ検証操作</summary>
      {!tournament && <div className={styles.demoFoldControls}><span>相手のフォールド確認（デモ）</span>{seats.map((seat, i) => <button type="button" key={seat.name} aria-pressed={foldedSeats.includes(i + 2)} onClick={() => setFoldedSeats(prev => prev.includes(i + 2) ? prev.filter(n => n !== i + 2) : [...prev, i + 2])}>P{i + 2} {foldedSeats.includes(i + 2) ? "復帰" : "FOLD"}</button>)}</div>}
      <div className={styles.demoSteps}><button type="button" disabled onClick={() => {}}>{streetStep === 4 ? "ショーダウン表示中" : `自動進行中：${streetNames[streetStep + 1]}`}</button><button className={styles.reset} type="button" disabled={dealing || !canStartHand || tournamentComplete} onClick={reset}>{dealing ? "配布中…" : tournamentComplete ? "大会終了" : !handActive ? "大会デモを開始" : payouts ? "次のハンド" : "デモをリセット"}</button></div>
      </details>
    </div> : <div className={styles.spectatorPanel}>観戦モード：操作ボタンは非表示です。左上の☰ → 観戦から席に戻れます。</div>}
    </div>
    {seatConfirm && <div className={styles.seatOverlay}><div className={styles.seatDialog} role="dialog" aria-modal="true" aria-labelledby="seat-confirm-title"><h2 id="seat-confirm-title">着席の確認</h2><p>この空席に着席しますか？</p><p>デモのため、実際の着席やチップ移動は行いません。</p><div className={styles.seatDialogActions}><button type="button" onClick={() => setSeatConfirm(false)}>キャンセル</button><button type="button" disabled={dealing} onClick={() => { setSpectating(false); setSeatConfirm(false); void reset(); }}>着席する</button></div></div></div>}
  </section>;
}

function Seat({ name, stack, index, active, seconds, winnerGlow, seatStatus, stamp, folded, lastAction, allIn }: { allIn?: boolean; folded?: boolean; name: string; stack: string; index: number; showdown: boolean; active: boolean; seconds: number; positionLabel?: string; lastAction?: string; winnerGlow?: boolean; seatStatus?: string; dealer?: boolean; stamp?: { stamp: StampId; key: number } }) {
  const progress = Math.max(0, Math.min(100, (1 - seconds / DEMO_TURN_SECONDS) * 100));
  return <div className={`${styles.seat} ${seatStatus ? styles.inactiveSeat : ""} ${active ? styles.seatActive : ""} ${winnerGlow ? styles.winnerSeat : ""}`} data-folded={folded || undefined}>
    <div className={styles.seatAvatarRow}>
      <div className={styles.seatTimerRing} data-turn={active ? (seconds <= 5 ? "urgent" : "on") : undefined} style={{ background: active ? `conic-gradient(from 0deg, ${seconds <= 5 ? "#f05b58" : "#f3c663"} ${progress}%, #42586c 0)` : undefined }} aria-label={active ? `残り${seconds}秒` : undefined}><div data-pot-target={`p${index}`} data-motion-stack={`p${index}`} className={styles.avatar}><PlayerAvatar name={`PLAYER ${index}`} className={styles.memberAvatarImage}/>{folded && <span className={styles.seatFold} aria-hidden="true">FOLD</span>}</div></div>
      {stamp && <StampBubble key={stamp.key} stamp={stamp.stamp}/>}
    </div>
    {(() => { const k = seatActionKind(lastAction, allIn, folded); return k && k !== "fold" && <div className={styles.seatAct} data-kind={k}><b key={lastAction}>{k === "allin" ? "ALL-IN" : k === "bet" ? (lastAction?.startsWith("BET") ? "BET" : "RAISE") : k.toUpperCase()}</b></div>; })()}
    <span>{name}</span><small data-len={String(stack).length}>{stack}</small>{seatStatus && <span className={styles.eliminatedTag}>{seatStatus}</span>}

  </div>;
}

/** The last action of a seat on this street, for the ribbon on its avatar (phone practice table, owner 2026/10/28). */
function seatActionKind(lastAction?: string, allIn?: boolean, folded?: boolean): "fold" | "check" | "call" | "bet" | "allin" | null {
  if (folded) return "fold";
  if (!lastAction) return null;
  if (allIn) return "allin";
  if (lastAction.startsWith("CHECK")) return "check";
  if (lastAction.startsWith("CALL")) return "call";
  if (lastAction.startsWith("BET") || lastAction.startsWith("RAISE")) return "bet";
  return null;
}

/** Use the same official mark as navigation rather than a hand-drawn substitute. */
function ThumbLogo() { return <SummitMark className={styles.thumbLogo}/>; }
