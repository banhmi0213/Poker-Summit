import type { SupabaseClient } from "@supabase/supabase-js";

export async function logAdminAction(
  supabase: SupabaseClient,
  action: string,
  targetType?: string,
  targetId?: string,
  detail?: Record<string, unknown>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("audit_log").insert({
    actor_user_id: user?.id ?? null,
    actor_email: user?.email ?? null,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    detail: detail ?? null,
  });
}
