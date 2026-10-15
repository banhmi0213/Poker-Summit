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

export default async function PokerDemoPage({ searchParams }: { searchParams?: { mode?: string; game?: string; tournament?: string } }) {
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
    tournament = {id:"sample", title:"SUMMIT トーナメント設定サンプル", owner_store_id:null,starts_at:new Date(serverNow).toISOString(),published:false,structure:defaultStructure,image_url:null};
  }
  const displayName = typeof user?.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()
    ? user.user_metadata.display_name.trim() : user ? "会員" : "デモユーザー";
  return <div className="portal">
    <PortalHeader userEmail={user?.email} />
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "20px 12px 100px" }}>
      <PokerTablePreview tournament={tournament} serverNow={serverNow} initialDeal={dealDemoHand(["you", "p5", "p3", "p2", "p4", "p6"], 5)} member={{ displayName, avatarUrl: profile?.avatar_url ?? null }} isGuestPreview={!user} initialSpectating={searchParams?.mode === "spectate"} />
    </main>
    <PortalFooter />
    <BottomTabs />
  </div>;
}
