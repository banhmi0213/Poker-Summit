"use server";
import { revalidatePath } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { createNewsDrafts } from "@/lib/news-auto";

export type NewsDraftState = { error?: string; success?: string };

// BLOG管理の「ニュースの下書きを今すぐ作る」(2026/10/23)。毎日の自動作成と同じ処理を1本だけ動かす。
export async function runNewsDraftNow(_state: NewsDraftState, _formData: FormData): Promise<NewsDraftState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "管理者ログインが必要です。" };
  const { data: admin } = await supabase.rpc("is_admin");
  if (admin !== true) return { error: "運営権限がありません。" };
  const result = await createNewsDrafts(1);
  await logAdminAction(supabase, "news_drafts_manual", "blog", undefined, result);
  revalidatePath("/admin/blog");
  if (result.error) return { error: result.error };
  if (result.created.length) return { success: `下書きを作りました: ${result.created.map((c) => c.title).join(" / ")}` };
  return { error: `下書きは作りませんでした: ${result.skipped.join(" / ") || "理由不明"}` };
}
