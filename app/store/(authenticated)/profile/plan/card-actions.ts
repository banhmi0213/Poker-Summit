"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createCardRegistrationSession } from "@/lib/komoju";
import { SITE_URL } from "@/lib/seo";

const CARD_SESSION_COOKIE = "ps_card_session";

/** カードの登録・変更: KOMOJUのカード登録ページへ移動する */
export async function startCardRegistration() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/store/login");

  const svc = createServiceRoleClient();
  const { data: store } = await svc.from("stores").select("id").eq("owner_user_id", user.id).maybeSingle();
  const { data: contract } = store
    ? await svc.from("store_contracts").select("id, contact_email").eq("store_id", store.id).eq("status", "active").maybeSingle()
    : { data: null };
  if (!contract) redirect(`/store/profile/plan?error=${encodeURIComponent("有効な契約が見つかりません。運営にお問い合わせください。")}`);

  let sessionUrl: string | null = null;
  let failure: string | null = null;
  try {
    const session = await createCardRegistrationSession({
      returnUrl: `${SITE_URL}/store/profile/plan/card`,
      email: contract.contact_email,
      externalCustomerId: `contract-${contract.id}`,
    });
    const jar = await cookies();
    jar.set(CARD_SESSION_COOKIE, session.id, { httpOnly: true, secure: true, sameSite: "lax", path: "/store", maxAge: 60 * 60 });
    sessionUrl = session.session_url;
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
  }
  if (!sessionUrl) {
    redirect(`/store/profile/plan?error=${encodeURIComponent(`カード登録ページを開けませんでした。${failure ? `(${failure.slice(0, 120)})` : ""}`)}`);
  }
  redirect(sessionUrl);
}
