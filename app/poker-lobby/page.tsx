import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {PokerWorkspace} from "@/app/poker-ui/workspace";
import TournamentRegistration from "./tournament-registration";
import AssignedRooms from "./assigned-rooms";
import PokerLobbyPreview from "./poker-lobby-preview";

export const metadata: Metadata = { title: "オンラインポーカー ロビー試作 | Poker Summit", robots: { index: false, follow: false } };

export default async function PokerLobbyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
  if (!user && !isPreview) redirect("/signup");
  const {data: tournaments} = await supabase.from("poker_tournaments").select("id,title,starts_at,structure,image_url,organizer_name,prizes").eq("published",true).order("starts_at");
  const {data:isAdmin}=user?await supabase.rpc('is_admin'):{data:false};
  return <PokerWorkspace kind="lobby" admin={isAdmin===true} guest={!user} panes={[
   {id:'assigned',label:'あなたの参加卓',eyebrow:'YOUR TABLE',description:'割り当て済みの卓へ入室・再接続できます。',content:user?<AssignedRooms enabled={Boolean(process.env.POKER_ROOM_SERVICE_ORIGIN)}/>:<p>参加卓の確認には<a href="/login">ログイン</a>してください。</p>},
   {id:'registration',label:'大会の参加受付',eyebrow:'TOURNAMENT ENTRY',description:'受付中の大会へ参加登録し、開催を待ちましょう。',content:user?<TournamentRegistration enabled={Boolean(process.env.POKER_ROOM_SERVICE_ORIGIN)}/>:<p>大会への登録には<a href="/login">ログイン</a>してください。</p>},
   {id:'demo',label:'デモ・プレイ体験',eyebrow:'PRACTICE TABLES',description:'ゲームの流れやテーブル操作を体験できます。',content:<PokerLobbyPreview compact configuredTournaments={tournaments??[]} isGuestPreview={!user}/>}
  ]}/>;
}
