import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import PokerTablePreview from "./poker-table-preview";

export const metadata: Metadata = { title: "オンラインポーカー UI試作 | Poker Summit", robots: { index: false, follow: false } };

export default async function PokerDemoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/poker-demo");
  const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("user_id", user.id).maybeSingle();
  const displayName = typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()
    ? user.user_metadata.display_name.trim() : "会員";
  return <div className="portal">
    <PortalHeader userEmail={user?.email} />
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "20px 12px 100px" }}>
      <PokerTablePreview member={{ displayName, avatarUrl: profile?.avatar_url ?? null }} />
    </main>
    <PortalFooter />
    <BottomTabs />
  </div>;
}
