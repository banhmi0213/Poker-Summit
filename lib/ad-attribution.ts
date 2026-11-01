import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * 広告のリンクから来た会員を記録する(2026/10/21、public.ad_attributions)。
 * 1人1件。最初に来た広告の目印を残す(あとから別の広告で来ても上書きしない)。失敗しても画面は止めない。
 */
export async function recordAdAttribution(userId: string, source: string | null, via: "signup" | "visit") {
  if (!source) return;
  try {
    await createServiceRoleClient()
      .from("ad_attributions")
      .upsert({ user_id: userId, source, via }, { onConflict: "user_id", ignoreDuplicates: true });
  } catch {
    // 記録できなくても何もしない
  }
}
