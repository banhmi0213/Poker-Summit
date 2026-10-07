import "server-only";
import { redirect, notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TERMS_VERSION, PRIVACY_VERSION, MATCHING_RULES_VERSION } from "./legal";
import { matchingReturn, type MatchingActor } from "./matching-return";

export async function requireMatchingConsent(db: SupabaseClient, userId: string, actor: MatchingActor, next: string): Promise<void> {
 const [consent, suspended] = await Promise.all([
  db.from("user_legal_consents").select("id").eq("user_id", userId).eq("scope", "matching_"+actor).eq("terms_version", TERMS_VERSION).eq("privacy_version", PRIVACY_VERSION).eq("rules_version", MATCHING_RULES_VERSION).maybeSingle(),
  db.rpc("is_suspended"),
 ]);
 if (consent.error || suspended.error) throw new Error("利用規約への同意状況を確認できませんでした。");
 if (suspended.data) notFound();
 if (!consent.data) redirect("/matching/consent?"+new URLSearchParams({ actor, next: matchingReturn(actor,next) }).toString());
}
