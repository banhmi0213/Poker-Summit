import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createStoreClient } from "@/lib/supabase/store-server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { TERMS_VERSION, PRIVACY_VERSION, MATCHING_RULES_VERSION } from "@/lib/legal";
import { MatchingConsentForm } from "./form";
import { matchingReturn } from "@/lib/matching-return";
export const dynamic = "force-dynamic";
export default async function ConsentPage({ searchParams }: { searchParams: { actor?: string; next?: string } }) {
 const actor = searchParams.actor ?? "dealer";
 if (actor !== "store" && actor !== "dealer") notFound();
 const next = matchingReturn(actor, searchParams.next);
 const consentUrl = "/matching/consent?"+new URLSearchParams({ actor, next }).toString();
 const supabase = actor === "store" ? await createStoreClient() : await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) redirect((actor === "store" ? "/store/login" : "/login")+"?next="+encodeURIComponent(consentUrl));
 const { data: suspended, error: suspendedError } = await supabase.rpc("is_suspended");
 if (suspendedError || suspended) notFound();
 const access = actor === "store" ? await supabase.from("stores").select("id").eq("owner_user_id",user.id).limit(1).maybeSingle() : await supabase.from("dealer_profiles").select("user_id").eq("user_id",user.id).maybeSingle();
 if (access.error || !access.data) notFound();
 const { data: accepted, error } = await supabase.from("user_legal_consents").select("id").eq("user_id",user.id).eq("scope","matching_"+actor).eq("terms_version",TERMS_VERSION).eq("privacy_version",PRIVACY_VERSION).eq("rules_version",MATCHING_RULES_VERSION).maybeSingle();
 if (error) throw new Error("同意情報を読み込めませんでした。");
 if (accepted) redirect(next);
 return <><PortalHeader userEmail={user.email} /><main className="container" style={{ maxWidth: 620 }}><h1 style={{ fontSize: 22 }}>スポット勤務・マッチングの利用確認</h1><MatchingConsentForm actor={actor} next={next} /></main><PortalFooter /></>;
}

