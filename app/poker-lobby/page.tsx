import {pokerAccess} from '@/lib/poker/access';
import {ringColumns,type RingTable} from '@/lib/poker/ring-tables';
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LobbyDashboard from "./lobby-dashboard";
import TournamentRegistration from "./tournament-registration";
import AssignedRooms from "./assigned-rooms";
import {POKER_TOURNAMENTS_ENABLED} from "@/lib/poker/features";

export const metadata: Metadata = { title: "ポーカーロビー | Poker Summit", robots: { index: false, follow: false } };

export default async function PokerLobbyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
  if (!user && !isPreview) redirect("/signup");
  if (user && pokerAccess(user) === "verify") redirect("/mypage?poker=verify");
  const {data: tournaments} = await supabase.from("poker_tournaments").select("id,title,starts_at,structure,image_url,organizer_name,prizes").eq("published",true).order("starts_at");
  const {data:ringRows,error:ringError}=await supabase.from('poker_ring_tables').select(ringColumns).eq('published',true).is('deleted_at',null).order('sort_order').order('created_at');
  // 運営にも一般会員と同じ画面を見せる（オーナー 2026/11/04：一般ユーザーが見るようにせな修正箇所わからん）。総合管理へのリンクは出さない。
  // サミット（掲示板）の新着：プレイの合間に話題が目に入るように（オーナー 2026/10/27）。
  const {data:boardRows}=user?await supabase.from('board_posts').select('id,title,created_at').eq('status','visible').order('created_at',{ascending:false}).limit(6):{data:null};
  const boardFeed=boardRows?.length?<section aria-label="サミットの新着" style={{marginTop:20}}><h3 style={{fontSize:15,margin:'0 0 8px'}}>サミットの新着</h3><ul style={{listStyle:'none',margin:0,padding:0,display:'grid',gap:6}}>{boardRows.map(p=><li key={p.id}><a href={`/board/${p.id}`}>{p.title}</a> <small style={{opacity:.7}}>{new Date(p.created_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></li>)}</ul><p style={{fontSize:13,margin:'8px 0 0'}}><a href="/board">サミットを開く</a>・気になったハンドはハンド履歴から「掲示板で相談する」で投稿できます。</p></section>:null;
  return <LobbyDashboard guest={!user} admin={false}
    memberName={user?.user_metadata?.display_name || '会員'}
    ringEnabled={Boolean(process.env.POKER_ROOM_SERVICE_ORIGIN)}
    tournamentsEnabled={POKER_TOURNAMENTS_ENABLED}
    rings={(ringRows??[]) as RingTable[]} ringError={Boolean(ringError)}
    tournaments={tournaments??[]} board={boardFeed}
    assigned={user?<AssignedRooms enabled={Boolean(process.env.POKER_ROOM_SERVICE_ORIGIN)}/>:<p>参加テーブルの確認には<a href="/login">ログイン</a>してください。</p>}
    registration={user?<TournamentRegistration enabled={Boolean(process.env.POKER_ROOM_SERVICE_ORIGIN)}/>:<p>大会への登録には<a href="/login">ログイン</a>してください。</p>}
  />;
}
