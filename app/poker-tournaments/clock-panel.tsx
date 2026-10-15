"use client";
import { useEffect, useState } from "react";
import { tournamentClock, clockText, type PokerTournament } from "@/lib/poker/tournament";
import styles from "./clock-panel.module.css";
import PrizeView from "./prize-view";
import StructureView from "./structure-view";
export default function TournamentPanel({ tournament, serverNow, mode = "clock" }: {
    tournament: PokerTournament;
    serverNow: number;
    mode?: "clock" | "structure";
}) {
    const [now, setNow] = useState(serverNow);
    useEffect(() => { setNow(Date.now()); const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
    const c = tournamentClock(tournament.structure, tournament.starts_at, now);
    if (mode === "structure")
        return <div className={styles.structure}>{tournament.image_url && <img className={styles.backdrop} src={tournament.image_url} alt=""/>}<div className={styles.content}><h2>{tournament.title}</h2><PrizeView tournament={tournament}/><StructureView structure={tournament.structure} currentIndex={c.index}/></div></div>;
    const following = tournament.structure.periods[c.index + 1];
    const isBreak = c.phase === "break", isWaiting = c.phase === "scheduled";
    return <aside aria-label="トーナメント・ブラインドタイマー" className={styles.clock}>{tournament.image_url && <img className={styles.backdrop} src={tournament.image_url} alt=""/>}<div className={styles.content}><strong>{tournament.title}</strong>{tournament.organizer_name && <small>主催：{tournament.organizer_name}</small>}<div className={styles.readout}><span>{isWaiting ? "開始まで" : isBreak ? "休憩" : `LEVEL ${c.level}`}</span><b role="timer" aria-label={isWaiting ? "開始までの残り時間" : isBreak ? "休憩の残り時間" : "現在レベルの残り時間"}>{c.phase === "final" ? "最終レベル継続" : clockText(c.remaining)}</b></div><p>{isBreak ? c.period.note : `SB ${c.period.sb.toLocaleString()} / BB ${c.period.bb.toLocaleString()} · Ante ${c.period.ante.toLocaleString()}${tournament.structure.anteType === "bb" ? "（BB）" : tournament.structure.anteType === "per-player" ? "（全員）" : ""}`}</p>{following?.kind === "break" && !isWaiting ? <small>次：休憩 {following.minutes}分 {following.note}</small> : c.next && !isWaiting && <small>次：{c.next.sb.toLocaleString()} / {c.next.bb.toLocaleString()} · Ante {c.next.ante.toLocaleString()}</small>}<small>{c.registrationOpen ? `レイトレジスト期間内${tournament.structure.reentry ? "・リエントリー可" : ""}` : "レイトレジスト締切"}</small><small>ストラクチャー表示プレビュー。下の対戦デモは50/100・アンティなしで動作します。</small></div></aside>;
}
