"use server";

import { createClient } from "@/lib/supabase/server";
import { dealDemoHand } from "@/lib/poker/demo-deal";

export async function requestDemoDeal(buttonIndex: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
  if (!user && !isPreview) throw new Error("ログインしてから再度お試しください");
  // No user-provided deck or seat list. No wallet/database writes.
  return dealDemoHand(["you", "p5", "p3", "p2", "p4", "p6"], buttonIndex);
}
