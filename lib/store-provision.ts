import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateStoreLinkCode } from "@/lib/store-update";

// ============================================================================
// セルフサーブ申込み(listing_applications, plan_id付き)がfincodeの初回課金に
// 成功した直後に呼ばれる、店舗の自動作成〜ログイン/LINE連携コード発行まで
// 一式。app/admin/stores/actions.ts の issueStoreLogin() / issueStoreLineLinkCode()
// と同じ処理を、管理者セッションなし(=is_admin()が通らないservice-role実行)
// でも行えるようにしたもの。RPCはsystem_issue_store_login()を使う
// (admin_issue_store_login()とは別物。マイグレーション参照)。
// ============================================================================

function randomPassword(length = 10) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < length; i++) {
          out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

function randomLoginId(storeId: string) {
    return `store-${storeId.slice(0, 8)}`;
}

type ListingApplicationRow = {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    tel: string | null;
    pref: string | null;
    category: string | null;
    plan_id: string | null;
};

export async function provisionPaidStoreFromApplication(params: {
    application: ListingApplicationRow;
    fincodeCustomerId: string;
    fincodeSubscriptionId: string;
}): Promise<{ storeId: string; loginId: string; password: string; lineCode: string }> {
    const supabase = createServiceRoleClient();
    const { application } = params;

  const { data: store, error: storeError } = await supabase
      .from("stores")
      .insert({
              name: application.company_name,
              category: application.category,
              pref: application.pref,
              tel: application.tel,
              status: "approved",
              source_application_id: application.id,
      })
      .select("id")
      .single();

  if (storeError || !store) {
        throw new Error(storeError?.message ?? "店舗の作成に失敗しました。");
  }
    const storeId = store.id as string;

  const { error: contractError } = await supabase.from("store_contracts").insert({
        store_id: storeId,
        plan_id: application.plan_id,
        status: "active",
        contact_name: application.contact_name,
        contact_email: application.email,
        contact_tel: application.tel,
        fincode_customer_id: params.fincodeCustomerId,
        fincode_subscription_id: params.fincodeSubscriptionId,
        last_billing_status: "success",
        last_billing_at: new Date().toISOString(),
  });
    if (contractError) {
          throw new Error(contractError.message);
    }

  const loginId = randomLoginId(storeId);
    const password = randomPassword();

  const { error: loginError } = await supabase.rpc("system_issue_store_login", {
        p_store_id: storeId,
        p_login_id: loginId,
        p_password: password,
  });
    if (loginError) {
          throw new Error(loginError.message);
    }

  const lineCode = await generateStoreLinkCode(supabase, storeId);

  const { error: appUpdateError } = await supabase
      .from("listing_applications")
      .update({
              status: "approved",
              store_id: storeId,
              payment_status: "active",
              issued_login_id: loginId,
              issued_password: password,
              issued_line_code: lineCode,
      })
      .eq("id", application.id);
    if (appUpdateError) {
          throw new Error(appUpdateError.message);
    }

  await supabase.from("audit_log").insert({
        actor_user_id: null,
        actor_email: null,
        action: "store_self_serve_provisioned",
        target_type: "store",
        target_id: storeId,
        detail: { applicationId: application.id, loginId },
  });

  return { storeId, loginId, password, lineCode };
}
