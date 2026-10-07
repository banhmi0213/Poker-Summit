"use server";
import { redirect } from "next/navigation";
import { matchingReturn } from "@/lib/matching-return";
import { createClient } from "@/lib/supabase/server";
import { createStoreClient } from "@/lib/supabase/store-server";
import { TERMS_VERSION, PRIVACY_VERSION, MATCHING_RULES_VERSION } from "@/lib/legal";
export type ConsentState = { error: string; done: boolean };
export async function acceptMatchingRules(actor: "store" | "dealer", _previous: ConsentState, form: FormData): Promise<ConsentState> {
 if (actor !== "store" && actor !== "dealer") return { error: "利用区分を確認してください。", done: false };
 if (form.get("agree") !== "yes") return { error: "注意事項と規約への同意が必要です。", done: false };
 if (form.get("termsVersion") !== TERMS_VERSION || form.get("privacyVersion") !== PRIVACY_VERSION || form.get("rulesVersion") !== MATCHING_RULES_VERSION) return { error: "規約が更新されました。ページを更新してご確認ください。", done: false };
 const supabase = actor === "store" ? await createStoreClient() : await createClient();
 const { data: { user }, error: authError } = await supabase.auth.getUser();
 if (authError || !user) return { error: "ログインし直してください。", done: false };
 const { error } = await supabase.rpc("record_matching_consent", { p_actor: actor });
 if (error) return { error: "同意を記録できませんでした。アカウントの利用資格を確認して、もう一度お試しください。", done: false };
 redirect(matchingReturn(actor, String(form.get("next") ?? "")));
}

