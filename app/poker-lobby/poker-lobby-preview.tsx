"use client";
import type {RingTable} from '@/lib/poker/ring-tables';
import PrizeView from "../poker-tournaments/prize-view";

import { useState } from "react";
import Link from "next/link";
import type { TournamentStructure } from "@/lib/poker/tournament";
import styles from "./poker-lobby.module.css";

type GameType = "ring" | "tournament";
const ringTables = [
  { id: "ring-01", title: "SUMMIT BLUE 01", blind: "50 / 100", players: "4 / 6", status: "対戦中", seats: 2 },
  { id: "ring-02", title: "SUMMIT GREEN 02", blind: "10 / 20", players: "5 / 6", status: "対戦中", seats: 1 },
  { id: "ring-03", title: "SUMMIT GOLD 03", blind: "100 / 200", players: "6 / 6", status: "満席", seats: 0 },
];
const tournaments = [
  { id: "tourney-01", title: "POKER SUMMIT FREEROLL", entry: "無料", players: "18 / 36", status: "受付中", level: "5分", joinable: true },
  { id: "tourney-02", title: "SUMMIT NIGHT CUP", entry: "無料", players: "24 / 36", status: "進行中", level: "8分", joinable: false },
];

export default function PokerLobbyPreview({ isGuestPreview, configuredTournaments = [],configuredRings=[],ringError=false }: {configuredRings?:RingTable[];ringError?:boolean; isGuestPreview: boolean; configuredTournaments?: {id:string;title:string;starts_at:string;structure:TournamentStructure;image_url:string|null;organizer_name?:string;prizes?:import("@/lib/poker/tournament").TournamentPrize[]}[] }) {
  const [type, setType] = useState<GameType>("ring");
  const [selected, setSelected] = useState<{ title: string; action: "join" | "watch" } | null>(null);
  return <section className={styles.lobby}>
    <div className={styles.header}><span>♠ POKER SUMMIT</span><strong>LOBBY PREVIEW</strong></div>
    <h1>オンラインポーカー ロビー</h1>
    <p className={styles.note}>公開された大会設定とサンプル卓を表示しています。参加人数・参加操作はデモで、実際の対戦・大会への参加登録は行いません。{isGuestPreview ? "開発Previewではログイン不要です。" : ""}</p>
    <div className={styles.tabs} role="tablist" aria-label="ゲーム形式">
      <button type="button" role="tab" aria-selected={type === "ring"} className={type === "ring" ? styles.active : ""} onClick={() => setType("ring")}>リングゲーム</button>
      <button type="button" role="tab" aria-selected={type === "tournament"} className={type === "tournament" ? styles.active : ""} onClick={() => setType("tournament")}>トーナメント</button>
    </div>
    {type==='ring'&&<section aria-label="運営登録のリング卓"><div className={styles.sectionHeading}><h2>公開リング卓</h2><span>{configuredRings.length} 件</span></div>{ringError?<p role="alert">卓設定を読み込めませんでした。時間をおいて再読み込みしてください。</p>:!configuredRings.length?<p>現在、公開されているリング卓設定はありません。</p>:<div className={styles.list}>{configuredRings.map(t=><article className={styles.item} key={t.id}><div className={styles.emblem} aria-hidden="true"><span>♠</span><small>NLH</small></div><div className={styles.details}><div className={styles.itemTop}><strong>{t.title}</strong><span className={styles.live}>対戦準備中</span></div><p>SB {t.sb.toLocaleString()} / BB {t.bb.toLocaleString()} · {t.capacity}人卓</p><p>持込 {t.min_buy_in.toLocaleString()}〜{t.max_buy_in.toLocaleString()} チップ</p>{t.note&&<p>{t.note}</p>}<small>着席・会員チップによる対戦は準備中です。</small></div></article>)}</div>}</section>}
    <div className={styles.sectionHeading}><h2>{type === "ring" ? "練習用サンプル卓" : "トーナメント一覧"}</h2><span>{type === "ring" ? ringTables.length : tournaments.length} 件 · デモ</span></div>
    {type === "tournament" && configuredTournaments.length > 0 && <div className={styles.list}>{configuredTournaments.map(t=><article key={t.id} className={styles.item}>{t.image_url&&<img src={t.image_url} alt={`${t.title}の大会画像`} style={{width:80,height:80,objectFit:"cover",borderRadius:8,opacity:0.25}}/>}<div className={styles.details}><strong>{t.title}</strong><PrizeView tournament={t}/><p>{new Date(t.starts_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}（日本時間）</p><p>初期チップ {t.structure.startingStack.toLocaleString()} ／ レイトレジスト LV{t.structure.lateRegLevel}終了まで</p><Link className="btn" href={`/poker-demo?tournament=${t.id}`}>ストラクチャー・時計を確認</Link><small>開催設定のみ公開中。参加登録は未提供です。</small></div></article>)}</div>}
    {type === "tournament" && <p>以下はサンプル大会です。<Link href="/poker-demo?game=tournament">タイマー・ストラクチャーのサンプルを見る</Link></p>}
    <div className={styles.list}>
      {type === "ring" ? ringTables.map(t => <article className={styles.item} key={t.id}>
        <div className={styles.emblem} aria-hidden="true"><span>♠</span><small>NLH</small></div>
        <div className={styles.details}><div className={styles.itemTop}><strong>{t.title}</strong><span className={t.seats ? styles.live : styles.full}>{t.status}</span></div><p>ブラインド {t.blind} · 6 MAX</p><p>♟ {t.players} 人 · 空席 {t.seats}</p><div className={styles.actions}><button type="button" disabled={!t.seats} onClick={() => setSelected({ title: t.title, action: "join" })}>参加する</button><button type="button" onClick={() => setSelected({ title: t.title, action: "watch" })}>観戦する</button></div></div>
      </article>) : tournaments.map(t => <article className={styles.item} key={t.id}>
        <div className={styles.emblem} aria-hidden="true"><span>★</span><small>MTT</small></div>
        <div className={styles.details}><div className={styles.itemTop}><strong>{t.title}</strong><span className={styles.live}>{t.status}</span></div><p>参加費 {t.entry} · レベル {t.level}</p><p>♟ {t.players} 人</p><div className={styles.actions}><button type="button" disabled={!t.joinable} onClick={() => setSelected({ title: t.title, action: "join" })}>参加する</button><button type="button" disabled title="トーナメント観戦は対象外です">観戦する</button></div></div>
      </article>)}
    </div>
    {selected && <div className={styles.modalOverlay} role="presentation"><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="poker-lobby-confirm-title"><h2 id="poker-lobby-confirm-title">{selected.action === "join" ? "参加確認" : "観戦確認"}</h2><p>「{selected.title}」を{selected.action === "join" ? "参加" : "観戦"}しますか？</p><p className={styles.note}>試作画面のため、実際の着席や参加登録は行いません。</p><div className={styles.modalActions}><button type="button" onClick={() => setSelected(null)}>キャンセル</button><Link href={selected.action === "watch" ? "/poker-demo?mode=spectate" : type === "tournament" ? "/poker-demo?game=tournament" : "/poker-demo"}>テーブル画面へ</Link></div></div></div>}
  </section>;
}
