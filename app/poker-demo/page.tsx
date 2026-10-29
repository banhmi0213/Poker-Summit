import {pokerAccess} from '@/lib/poker/access';
import {POKER_TOURNAMENTS_ENABLED} from '@/lib/poker/features';
import {GameCommunity} from '@/app/poker-ui/game-community';
import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dealDemoHandAtTable } from "@/lib/poker/demo-deal";
import { defaultStructure, validateStructure, type PokerTournament } from "@/lib/poker/tournament";
import PokerTablePreview from "./poker-table-preview";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import GameNavigation from "./game-navigation";
import styles from "./poker-table.module.css";

export const metadata: Metadata = { title: "オンラインポーカー UI試作 | Poker Summit", robots: { index: false, follow: false } };

export default async function PokerDemoPage({ searchParams }: { searchParams?: { mode?: string; game?: string; tournament?: string; pace?: string; ante?: string; scenario?: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
  if (!user && !isPreview) redirect("/signup");
  if (user && pokerAccess(user) === "verify") redirect("/mypage?poker=verify");
  const { data: profile } = user ? await supabase.from("profiles").select("avatar_url").eq("user_id", user.id).maybeSingle() : { data: null };
  const serverNow = Date.now();
  let tournament: PokerTournament | undefined;
  // Ring-first release: tournament samples are hidden with the tournaments.
  if (!POKER_TOURNAMENTS_ENABLED && (searchParams?.tournament || searchParams?.game === "tournament")) notFound();
  if (searchParams?.tournament) {
    if (!/^[a-f0-9-]{36}$/i.test(searchParams.tournament)) notFound();
    const { data, error } = await supabase.from("poker_tournaments").select("id,title,owner_store_id,starts_at,published,structure,image_url,organizer_name,prizes").eq("id",searchParams.tournament).eq("published",true).maybeSingle();
    if (error || !data) notFound();
    tournament = {...data, structure: validateStructure(data.structure)} as PokerTournament;
  } else if (searchParams?.game === "tournament") {
    const fast = isPreview && searchParams?.pace === "fast";
    const structure = fast ? {...defaultStructure, startingStack:searchParams?.scenario === "short" || searchParams?.scenario === "heads-up" ? 200 : 10000, anteType:searchParams?.ante === "per-player" ? "per-player" as const : "bb" as const, lateRegLevel:2, periods:[
      {kind:"level" as const,minutes:1,sb:50,bb:100,ante:100,note:"1分レベル検証"},
      {kind:"level" as const,minutes:1,sb:75,bb:150,ante:150,note:""},
      {kind:"break" as const,minutes:1,sb:0,bb:0,ante:0,note:"休憩の開始・終了を検証"},
      {kind:"level" as const,minutes:1,sb:100,bb:200,ante:200,note:"最終レベル継続"}
    ]} : defaultStructure;
    tournament = {id:"sample", title:fast?"1分レベル・大会連動検証":"SUMMIT トーナメント設定サンプル", owner_store_id:null,starts_at:new Date(serverNow).toISOString(),published:false,structure,image_url:null};
  }
  const seats=["you", "p5", "p3", "p2", "p4", "p6"];
  const shortScenario=isPreview&&tournament?.id==="sample"&&searchParams?.pace==="fast"&&searchParams?.scenario;
  const initialSeatIds=shortScenario==="heads-up"?["you","p2"]:seats;
  const button=initialSeatIds.includes("p6")?"p6":initialSeatIds[0];
  const displayName = typeof user?.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()
    ? user.user_metadata.display_name.trim() : user ? "会員" : "デモユーザー";
  return <div className={`${styles.gamePage} ${styles.demoViewport}`}>
    <GameNavigation header={<PortalHeader userEmail={user?.email}/>} footer={<PortalFooter/>}/>
    <GameCommunity><main className={styles.gameMain}>
      {isPreview && <details className={styles.previewLinks}><summary>開発用テーブルを選択</summary>
      {isPreview && <p><a href="/poker-demo?game=tournament&pace=fast">1分レベル・BBアンティ検証</a> ／ <a href="/poker-demo?game=tournament&pace=fast&ante=per-player">1分レベル・全員アンティ検証</a></p>}
      {isPreview && <p><a href="/poker-demo?game=tournament&pace=fast&scenario=short">200チップ・脱落検証</a> ／ <a href="/poker-demo?game=tournament&pace=fast&scenario=heads-up">2人卓・優勝確定の検証</a></p>}
      {shortScenario && <p>検証専用：開始{initialSeatIds.length}人・各200チップ。保存された大会設定・会員残高には影響しません。</p>}
      </details>}
      <PokerTablePreview initialSeatIds={initialSeatIds} tournament={tournament} serverNow={serverNow} initialDeal={dealDemoHandAtTable(seats,initialSeatIds,button)} member={{ displayName, avatarUrl: profile?.avatar_url ?? null }} isGuestPreview={!user} initialSpectating={!tournament && searchParams?.mode === "spectate"} />
    </main></GameCommunity>
  </div>;
}
