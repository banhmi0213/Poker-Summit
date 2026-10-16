"use server";

import { createClient } from "@/lib/supabase/server";
import { dealDemoHandAtTable } from "@/lib/poker/demo-deal";

export async function requestDemoDeal(buttonIndex: number, liveIds?: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
  if (!user && !isPreview) throw new Error("ログインしてから再度お試しください");
  const seats=["you", "p5", "p3", "p2", "p4", "p6"];
  const live=liveIds??seats;
  if(!Number.isInteger(buttonIndex)||buttonIndex<0||buttonIndex>=seats.length||!Array.isArray(live)||live.length<2||live.length>6||new Set(live).size!==live.length||live.some(id=>!seats.includes(id)))throw new Error("配席情報を確認してください");
  // This local demo accepts only a subset of its fixed seats; no supplied cards,
  // wallet writes or authoritative multiplayer/registration state.
  return dealDemoHandAtTable(seats,seats.filter(id=>live.includes(id)),seats[buttonIndex]);
}
