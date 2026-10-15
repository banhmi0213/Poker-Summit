import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import PokerLobbyPreview from "./poker-lobby-preview";

export const metadata: Metadata = { title: "オンラインポーカー ロビー試作 | Poker Summit", robots: { index: false, follow: false } };

export default async function PokerLobbyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
  if (!user && !isPreview) redirect("/signup");
  const {data: tournaments} = await supabase.from("poker_tournaments").select("id,title,starts_at,structure,image_url,organizer_name,prizes").eq("published",true).order("starts_at");
  return <div className="portal">
    <PortalHeader userEmail={user?.email} />
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "20px 12px 100px" }}>
      <PokerLobbyPreview configuredTournaments={tournaments ?? []} isGuestPreview={!user} />
    </main>
    <PortalFooter />
    <BottomTabs />
  </div>;
}
