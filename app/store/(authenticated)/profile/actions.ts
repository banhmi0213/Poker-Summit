"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import {
  applyInstantStoreFieldsUpdate,
  hasPendingStoreChangeRequest,
  requestStoreFieldChange,
} from "@/lib/store-update";

export async function updateStoreProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const storeId = String(formData.get("storeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "");
  const tel = String(formData.get("tel") ?? "");
  const hours = String(formData.get("hours") ?? "");
  const nearestStation = String(formData.get("nearestStation") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const lineUrl = String(formData.get("lineUrl") ?? "").trim();
  const areaKeywords = String(formData.get("areaKeywords") ?? "").trim();

  if (!name) {
    throw new Error("店舗名を入力してください。");
  }

  const { data: current, error: fetchError } = await supabase
    .from("stores")
    .select("id, name, pref, city, address")
    .eq("id", storeId)
    .eq("owner_user_id", user.id)
    .single();

  if (fetchError || !current) {
    throw new Error("この店舗を編集する権限がありません。");
  }

  const requestedBy = `web:${user.id}`;

  // 店名・住所は検索・地図・現在地検索・ナビに影響するため、即時反映せず
  // 運営承認後に反映する「変更申請」として保存する(store-update.ts参照)。
  // すでに承認待ちの申請がある場合は多重申請にせず、その旨だけ伝える。
  if (name !== (current.name ?? "")) {
    if (await hasPendingStoreChangeRequest(supabase, storeId, "name")) {
      throw new Error("店舗名の変更はすでに運営の承認待ちです。承認され次第、反映されます。");
    }
    await requestStoreFieldChange(supabase, {
      storeId,
      field: "name",
      currentValue: { name: current.name },
      proposedValue: { name },
      requestedBy,
    });
  }

  const addressChanged =
    pref !== (current.pref ?? "") ||
    city !== (current.city ?? "") ||
    address !== (current.address ?? "");
  if (addressChanged) {
    if (await hasPendingStoreChangeRequest(supabase, storeId, "address")) {
      throw new Error("住所の変更はすでに運営の承認待ちです。承認され次第、反映されます。");
    }
    await requestStoreFieldChange(supabase, {
      storeId,
      field: "address",
      currentValue: { pref: current.pref, city: current.city, address: current.address },
      proposedValue: {
        pref: pref || null,
        city: city || null,
        address: address || null,
      },
      requestedBy,
    });
  }

  // 上記以外は今まで通り即時反映 + 変更履歴を記録。
  await applyInstantStoreFieldsUpdate(supabase, storeId, "web", requestedBy, {
    category: category || null,
    tel,
    hours,
    nearestStation: nearestStation || null,
    description,
    lineUrl: lineUrl || null,
    areaKeywords: areaKeywords || null,
  });

  // 公開サイト側(店舗詳細ページ)と総合管理画面も、Web側からの更新を即座に
  // 反映する(LINE側 /api/liff/store の revalidate と揃える)。
  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/admin/stores");
}

// ---------------------------------------------------------------------------
// 店舗管理画面の「LINE・メールの登録をお願いします」アナウンスから呼ばれる
// 2つのアクション(2026/10、「全店舗有料掲載店にはLINE、メールアドレスの
// 登録をお願いします的な」との指示を受けて追加)。
// どちらも、store_contracts/store_link_codes への直接の書き込み権限が
// ない店舗オーナー自身のセッションから呼べるよう、security definer RPC
// (update_my_store_contact_email() / issue_my_store_line_link_code())
// を介している。RLS参照はそれぞれのRPCのコメントを参照。
// ---------------------------------------------------------------------------

export async function updateMyStoreContactEmail(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  if (!contactEmail) {
    throw new Error("メールアドレスを入力してください。");
  }

  const { error } = await supabase.rpc("update_my_store_contact_email", {
    p_email: contactEmail,
  });
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
}

// LINE連携用ワンタイムコードを店舗オーナー自身が再発行する。発行結果
// (コード)は画面に表示する必要があるため、member-actions.ts の
// applyError/applyDone と同じく、クエリパラメータ経由で/store/profileに
// 戻す。
export async function issueMyStoreLineLinkCode() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const { data: code, error } = await supabase.rpc("issue_my_store_line_link_code");
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
  redirect(`/store/profile?lineCode=${encodeURIComponent(String(code))}#notify-banner`);
}
