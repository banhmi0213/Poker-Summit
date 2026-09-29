"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { geocodeAddress } from "@/lib/geocode";
import {
  approveStoreChangeRequest,
  generateStoreLinkCode,
  rejectStoreChangeRequest,
} from "@/lib/store-update";
import { PICKUP_PER_PREF_LIMIT } from "@/lib/contracts";

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

export async function setStoreStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, `store_status_${status}`, "store", id);

  // 掲載状態は公開サイトの一覧・詳細・店舗自身のダッシュボードすべてに
  // 影響するので、まとめて即時反映する。
  revalidatePath("/admin/stores");
  revalidatePath("/");
  revalidatePath("/stores");
  revalidatePath(`/stores/${id}`);
  revalidatePath("/store/profile");
}

// PICK UP店舗は「都道府県ごとに最大10店舗」の契約上限がある。ONにする時だけ
// その店舗の都道府県で数え、10件に達していれば追加を拒否する(OFFにする分に
// は上限は関係ないのでチェック不要)。/admin/stores の既存トグルと
// /admin/contracts/pickup の新しい割当UI、両方がこの一本の関数を呼ぶので、
// 上限は経路によらず必ず効く(上限値は lib/contracts.ts と共有)。

export async function setStoreRecommended(id: string, recommended: boolean) {
  const supabase = await createClient();

  if (recommended) {
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("pref, is_recommended")
      .eq("id", id)
      .single();

    if (storeError) {
      throw new Error(storeError.message);
    }

    if (store.pref && !store.is_recommended) {
      const { count, error: countError } = await supabase
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("pref", store.pref)
        .eq("is_recommended", true);

      if (countError) {
        throw new Error(countError.message);
      }

      if ((count ?? 0) >= PICKUP_PER_PREF_LIMIT) {
        throw new Error(
          `${store.pref}のPICK UP契約はすでに上限(${PICKUP_PER_PREF_LIMIT}店舗)に達しています。別の店舗を解除してから追加してください。`
        );
      }
    }
  }

  const { error } = await supabase
    .from("stores")
    .update({ is_recommended: recommended })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, recommended ? "store_recommend_on" : "store_recommend_off", "store", id);

  revalidatePath("/admin/stores");
  revalidatePath("/");
  revalidatePath("/stores/featured");
  revalidatePath("/admin/contracts/pickup");
}

export async function setStoreOwnerByEmail(formData: FormData) {
  const supabase = await createClient();

  const storeId = String(formData.get("storeId") ?? "");
  const email = String(formData.get("email") ?? "").trim();

  if (!storeId || !email) {
    throw new Error("店舗とメールアドレスを指定してください。");
  }

  const { error } = await supabase.rpc("admin_set_store_owner_by_email", {
    p_store_id: storeId,
    p_email: email,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "store_set_owner", "store", storeId, { email });

  revalidatePath("/admin/stores");
}

export async function createStoreByAdmin(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const tel = String(formData.get("tel") ?? "").trim();
  const hours = String(formData.get("hours") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    throw new Error("店舗名を入力してください。");
  }

  // Best-effort: geocode the address so "現在地から探す" (search by current
  // location) has coordinates to sort by right away. A failed/empty lookup
  // just leaves lat/lng null — it never blocks creating the store.
  const geocoded = await geocodeAddress(pref, city, address);

  const { data, error } = await supabase
    .from("stores")
    .insert({
      name,
      category: category || null,
      region: region || null,
      pref: pref || null,
      city: city || null,
      address: address || null,
      tel: tel || null,
      hours: hours || null,
      description: description || null,
      status: "approved",
      lat: geocoded?.lat ?? null,
      lng: geocoded?.lng ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "store_create", "store", data?.id, { name });

  revalidatePath("/admin/stores");
  revalidatePath("/");
}

export async function updateStoreByAdmin(formData: FormData) {
  const supabase = await createClient();
  const storeId = String(formData.get("storeId") ?? "");

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const tel = String(formData.get("tel") ?? "").trim();
  const hours = String(formData.get("hours") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const areaKeywords = String(formData.get("areaKeywords") ?? "").trim();

  if (!name) {
    throw new Error("店舗名を入力してください。");
  }

  // Only re-geocode when the address actually changed — otherwise keep the
  // existing lat/lng as-is (avoids drifting an already-correct pin, and
  // avoids an extra network call, on every unrelated edit).
  const { data: existing } = await supabase
    .from("stores")
    .select("pref, city, address, lat, lng")
    .eq("id", storeId)
    .single();

  const addressChanged =
    !existing ||
    existing.pref !== (pref || null) ||
    existing.city !== (city || null) ||
    existing.address !== (address || null);

  // A failed/empty geocode lookup (network hiccup, no match) falls back to
  // whatever coordinates were already on the row rather than wiping out a
  // previously-good pin — geocoding is best-effort, not authoritative.
  const coords = addressChanged
    ? (await geocodeAddress(pref, city, address)) ?? {
        lat: existing?.lat ?? null,
        lng: existing?.lng ?? null,
      }
    : { lat: existing?.lat ?? null, lng: existing?.lng ?? null };

  const { error } = await supabase
    .from("stores")
    .update({
      name,
      category: category || null,
      region: region || null,
      pref: pref || null,
      city: city || null,
      address: address || null,
      tel: tel || null,
      hours: hours || null,
      description: description || null,
      area_keywords: areaKeywords || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    })
    .eq("id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "store_edit", "store", storeId);

  revalidatePath("/admin/stores");
  revalidatePath("/");
  revalidatePath(`/stores/${storeId}`);
  // 運営側が直接編集した内容も、店舗自身のLINE/Web管理画面に即座に反映する。
  revalidatePath("/store/profile");
}

export async function issueStoreLogin(storeId: string) {
  const supabase = await createClient();
  const loginId = randomLoginId(storeId);
  const password = randomPassword();

  const { error } = await supabase.rpc("admin_issue_store_login", {
    p_store_id: storeId,
    p_login_id: loginId,
    p_password: password,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "store_issue_login", "store", storeId, { loginId });

  const jar = await cookies();
  jar.set("issued_credentials", JSON.stringify({ storeId, loginId, password }), {
    httpOnly: true,
    maxAge: 60,
    path: "/admin/stores",
  });

  revalidatePath("/admin/stores");
  redirect("/admin/stores");
}

export async function reissueStorePassword(storeId: string) {
  const supabase = await createClient();
  const password = randomPassword();

  const { error } = await supabase.rpc("admin_reissue_store_password", {
    p_store_id: storeId,
    p_new_password: password,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data: loginId } = await supabase.rpc("admin_get_store_login_id", {
    p_store_id: storeId,
  });

  await logAdminAction(supabase, "store_reissue_password", "store", storeId);

  const jar = await cookies();
  jar.set("issued_credentials", JSON.stringify({ storeId, loginId, password }), {
    httpOnly: true,
    maxAge: 60,
    path: "/admin/stores",
  });

  revalidatePath("/admin/stores");
  redirect("/admin/stores");
}

export async function deleteStoreByAdmin(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stores").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "store_delete", "store", id);

  revalidatePath("/admin/stores");
  revalidatePath("/");
  revalidatePath("/stores");
  revalidatePath(`/stores/${id}`);
}

// ---------------------------------------------------------------------------
// LINEミニアプリ連携 — ワンタイムコード発行
// ---------------------------------------------------------------------------

export async function issueStoreLineLinkCode(storeId: string) {
  const supabase = await createClient();
  const code = await generateStoreLinkCode(supabase, storeId);

  await logAdminAction(supabase, "store_line_link_code_issued", "store", storeId);

  const jar = await cookies();
  jar.set("issued_line_link_code", JSON.stringify({ storeId, code }), {
    httpOnly: true,
    maxAge: 60,
    path: "/admin/stores",
  });

  revalidatePath("/admin/stores");
  redirect("/admin/stores");
}

// ---------------------------------------------------------------------------
// 店名・住所の変更申請 — 承認 / 却下
// ---------------------------------------------------------------------------

export async function approveStoreChangeRequestByAdmin(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const { storeId } = await approveStoreChangeRequest(supabase, requestId, user.id);

  await logAdminAction(supabase, "store_change_request_approved", "store_change_request", requestId);

  revalidatePath("/admin/stores");
  revalidatePath("/");
  revalidatePath("/stores");
  // 承認された店名・住所は、公開店舗ページと店舗自身のダッシュボード
  // (Web/LINEどちらから見ても)双方に即座に反映する。
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/store/profile");
}

export async function rejectStoreChangeRequestByAdmin(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  await rejectStoreChangeRequest(supabase, requestId, user.id, note || null);

  await logAdminAction(supabase, "store_change_request_rejected", "store_change_request", requestId, { note });

  revalidatePath("/admin/stores");
  // 却下により「承認待ち」バナーが消えるので、店舗自身のダッシュボードも
  // 即座に更新する(却下自体は公開ページには何も影響しない)。
  revalidatePath("/store/profile");
}