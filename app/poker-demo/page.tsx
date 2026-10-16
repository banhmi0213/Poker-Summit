import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { dealDemoHand } from "@/lib/poker/demo-deal";
import { defaultStructure, validateStructure, type PokerTournament } from "@/lib/poker/tournament";
import PokerTablePreview from "./poker-table-preview";

export const metadata: Metadata = { title: "オンラインポーカー UI試作 | Poker Summit", robots: { index: false, follow: false } };

export default async function PokerDemoPage({ searchParams }: { searchParams?: { mode?: string; game?: string; tournament?: string; pace?: string; ante?: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
  if (!user && !isPreview) redirect("/signup");
  const { data: profile } = user ? await supabase.from("profiles").select("avatar_url").eq("user_id", user.id).maybeSingle() : { data: null };
  const serverNow = Date.now();
  let tournament: PokerTournament | undefined;
  if (searchParams?.tournament) {
    if (!/^[a-f0-9-]{36}$/i.test(searchParams.tournament)) notFound();
    const { data, error } = await supabase.from("poker_tournaments").select("id,title,owner_store_id,starts_at,published,structure,image_url,organizer_name,prizes").eq("id",searchParams.tournament).eq("published",true).maybeSingle();
    if (error || !data) notFound();
    tournament = {...data, structure: validateStructure(data.structure)} as PokerTournament;
  } else if (searchParams?.game === "tournament") {
    const fast = isPreview && searchParams?.pace === "fast";
    const structure = fast ? {...defaultStructure, anteType:searchParams?.ante === "per-player" ? "per-player" as const : "bb" as const, lateRegLevel:2, periods:[
      {kind:"level" as const,minutes:1,sb:50,bb:100,ante:100,note:"1分レベル検証"},
      {kind:"level" as const,minutes:1,sb:75,bb:150,ante:150,note:""},
      {kind:"break" as const,minutes:1,sb:0,bb:0,ante:0,note:"休憩の開始・終了を検証"},
      {kind:"level" as const,minutes:1,sb:100,bb:200,ante:200,note:"最終レベル継続"}
    ]} : defaultStructure;
    tournament = {id:"sample", title:fast?"1分レベル・大会連動検証":"SUMMIT トーナメント設定サンプル", owner_store_id:null,starts_at:new Date(serverNow).toISOString(),published:false,structure,image_url:null};
  }
  const displayName = typeof user?.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()
    ? user.user_metadata.display_name.trim() : user ? "会員" : "デモユーザー";
  return <div className="portal">
    <PortalHeader userEmail={user?.email} />
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "20px 12px 100px" }}>
      {isPreview && <p><a href="/poker-demo?game=tournament&pace=fast">1分レベル・BBアンティ検証</a> ／ <a href="/poker-demo?game=tournament&pace=fast&ante=per-player">1分レベル・全員アンティ検証</a></p>}
      <PokerTablePreview tournament={tournament} serverNow={serverNow} initialDeal={dealDemoHand(["you", "p5", "p3", "p2", "p4", "p6"], 5)} member={{ displayName, avatarUrl: profile?.avatar_url ?? null }} isGuestPreview={!user} initialSpectating={searchParams?.mode === "spectate"} />
    </main>
    <PortalFooter />
    <BottomTabs />
  </div>;
}
