import type { SupabaseClient } from "@supabase/supabase-js";
import { geocodeAddress } from "@/lib/geocode";
import { primaryRegionForPref } from "@/lib/constants";

// Loose on purpose: this module is called with both the cookie-scoped
// server client (web portal, RLS-enforced) and the service-role client
// (LIFF routes, RLS-bypassing) — the exact Database generic type differs
// only in strictness, not in the methods used here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

type ActorType = "line" | "web" | "admin";

// ---------------------------------------------------------------------------
// One-time linking codes (LINE account <-> store identity check)
// ---------------------------------------------------------------------------

// Excludes 0/O and 1/I so a code read aloud or hand-copied isn't ambiguous.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function randomCode(length = CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

// Admin-issued code a store owner enters once inside the LIFF app to prove
// "this LINE account belongs to this store" and link the two.
export async function generateStoreLinkCode(
  supabase: AnySupabaseClient,
  storeId: string
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await supabase.from("store_link_codes").insert({
      store_id: storeId,
      code,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
    if (!error) return code;
    if (!/duplicate key/i.test(error.message)) {
      throw new Error(error.message);
    }
    // Unique-constraint collision on `code` — vanishingly unlikely, but
    // retry with a fresh random code rather than fail the admin's click.
  }
  throw new Error("ワンタイムコードの発行に失敗しました。もう一度お試しください。");
}

export async function consumeStoreLinkCode(
  supabase: AnySupabaseClient,
  code: string,
  lineUserId: string
): Promise<{ storeId: string; error?: undefined } | { storeId?: undefined; error: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { error: "コードを入力してください。" };

  const { data: row, error } = await supabase
    .from("store_link_codes")
    .select("id, store_id, expires_at, used_at")
    .eq("code", normalized)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!row) return { error: "コードが見つかりません。入力内容をご確認ください。" };
  if (row.used_at) return { error: "このコードはすでに使用されています。運営に再発行を依頼してください。" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { error: "このコードの有効期限が切れています。運営に再発行を依頼してください。" };
  }

  // One LINE account per store, one store per LINE account — refuse rather
  // than silently re-pointing an already-linked account.
  const { data: existingLink } = await supabase
    .from("stores")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (existingLink && existingLink.id !== row.store_id) {
    return { error: "このLINEアカウントはすでに別の店舗と連携されています。" };
  }

  const { error: updateError } = await supabase
    .from("stores")
    .update({ line_user_id: lineUserId })
    .eq("id", row.store_id);
  if (updateError) return { error: updateError.message };

  await supabase
    .from("store_link_codes")
    .update({ used_at: new Date().toISOString(), used_by_line_user_id: lineUserId })
    .eq("id", row.id);

  return { storeId: row.store_id };
}

// ---------------------------------------------------------------------------
// Update history (audit trail)
// ---------------------------------------------------------------------------

export async function recordStoreHistory(
  supabase: AnySupabaseClient,
  params: {
    storeId: string;
    actorType: ActorType;
    actorLabel: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }
): Promise<void> {
  const stringify = (v: unknown) =>
    v == null ? null : typeof v === "string" ? v : JSON.stringify(v);
  try {
    await supabase.from("store_update_history").insert({
      store_id: params.storeId,
      actor_type: params.actorType,
      actor_label: params.actorLabel,
      field: params.field,
      old_value: stringify(params.oldValue),
      new_value: stringify(params.newValue),
    });
  } catch {
    // A history-logging hiccup should never surface as if the underlying
    // store update itself failed — that write already committed.
  }
}

// ---------------------------------------------------------------------------
// Instant-apply fields (everything except name/address — see below)
// ---------------------------------------------------------------------------

export type InstantStoreFields = {
  tel?: string | null;
  hours?: string | null;
  description?: string | null;
  category?: string | null;
  lineUrl?: string | null;
  email?: string | null;
  xUrl?: string | null;
  instagramUrl?: string | null;
  areaKeywords?: string | null;
  nearestStation?: string | null;
};

const INSTANT_FIELD_COLUMNS: Record<keyof InstantStoreFields, string> = {
  tel: "tel",
  hours: "hours",
  description: "description",
  category: "category",
  lineUrl: "line_url",
  email: "email",
  xUrl: "x_url",
  instagramUrl: "instagram_url",
  areaKeywords: "area_keywords",
  nearestStation: "nearest_station",
};

// Applies whichever of tel/hours/description/category/lineUrl/areaKeywords
// were passed, diffs against the current row so only actually-changed
// columns are written, and logs one history row per changed field. Safe to
// call with a partial/empty `fields` object.
export async function applyInstantStoreFieldsUpdate(
  supabase: AnySupabaseClient,
  storeId: string,
  actorType: ActorType,
  actorLabel: string,
  fields: InstantStoreFields
): Promise<void> {
  const keys = (Object.keys(fields) as (keyof InstantStoreFields)[]).filter(
    (k) => fields[k] !== undefined
  );
  if (keys.length === 0) return;

  const columns = keys.map((k) => INSTANT_FIELD_COLUMNS[k]);
  const { data: existing, error: fetchError } = await supabase
    .from("stores")
    .select(columns.join(", "))
    .eq("id", storeId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const updatePayload: Record<string, string | null> = {};
  const changed: { field: string; oldValue: unknown; newValue: unknown }[] = [];

  for (const key of keys) {
    const column = INSTANT_FIELD_COLUMNS[key];
    const newValue = fields[key] ?? null;
    const oldValue = (existing as Record<string, unknown> | null)?.[column] ?? null;
    if (oldValue !== newValue) {
      updatePayload[column] = newValue;
      changed.push({ field: column, oldValue, newValue });
    }
  }

  if (changed.length === 0) return;

  const { error: updateError } = await supabase
    .from("stores")
    .update(updatePayload)
    .eq("id", storeId);
  if (updateError) throw new Error(updateError.message);

  for (const c of changed) {
    await recordStoreHistory(supabase, {
      storeId,
      actorType,
      actorLabel,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
    });
  }
}

// ---------------------------------------------------------------------------
// Name / address — never applied instantly (see store_change_requests
// migration comment): they drive search, the map, "現在地から探す" and
// navigation, so a store-side edit is only a *request* until an admin
// approves it.
// ---------------------------------------------------------------------------

export async function requestStoreFieldChange(
  supabase: AnySupabaseClient,
  params: {
    storeId: string;
    field: "name" | "address";
    proposedValue: Record<string, unknown>;
    currentValue: Record<string, unknown>;
    requestedBy: string; // e.g. "web:<supabase user id>" or "line:<lineUserId>"
  }
): Promise<void> {
  const { error } = await supabase.from("store_change_requests").insert({
    store_id: params.storeId,
    field: params.field,
    current_value: params.currentValue,
    proposed_value: params.proposedValue,
    requested_by: params.requestedBy,
  });
  if (error) throw new Error(error.message);
}

export async function hasPendingStoreChangeRequest(
  supabase: AnySupabaseClient,
  storeId: string,
  field: "name" | "address"
): Promise<boolean> {
  const { data } = await supabase
    .from("store_change_requests")
    .select("id")
    .eq("store_id", storeId)
    .eq("field", field)
    .eq("status", "pending")
    .maybeSingle();
  return Boolean(data);
}

// Applies an approved request's proposed_value onto the stores row. For an
// address change this also re-geocodes (lat/lng), same as the admin panel's
// own address edits — a store's location on the map should never fall out
// of sync with its published address.
export async function approveStoreChangeRequest(
  supabase: AnySupabaseClient,
  requestId: string,
  reviewerUserId: string
): Promise<{ storeId: string; field: "name" | "address" }> {
  const { data: request, error } = await supabase
    .from("store_change_requests")
    .select("id, store_id, field, proposed_value, status")
    .eq("id", requestId)
    .single();
  if (error) throw new Error(error.message);
  if (!request) throw new Error("変更申請が見つかりません。");
  if (request.status !== "pending") throw new Error("この申請はすでに処理済みです。");

  const proposed = request.proposed_value as Record<string, string | null>;
  const updatePayload: Record<string, unknown> = { ...proposed };

  if (request.field === "address") {
    const geocoded = await geocodeAddress(
      (proposed.pref as string | undefined) ?? null,
      (proposed.city as string | undefined) ?? null,
      (proposed.address as string | undefined) ?? null
    );
    updatePayload.lat = geocoded?.lat ?? null;
    updatePayload.lng = geocoded?.lng ?? null;

    // 店舗側(Web/LINE)で都道府県が変更された場合、総合管理画面の「地方」も
    // 都道府県から自動で連動させる(2026/09/30、手動での入れ忘れ・食い違いを
    // 防ぐため)。三重県のように地方が2つありうる県はPREF_REGIONの代表値
    // (近畿)を採用する。管理画面から手動で個別の地方に直したい場合は、
    // 従来通り店舗編集画面(/admin/stores/[id]/edit)で上書きできる。
    updatePayload.region = primaryRegionForPref(
      (proposed.pref as string | undefined) ?? null
    );
  }

  const columns = Object.keys(updatePayload);
  const { data: existing } = await supabase
    .from("stores")
    .select(columns.join(", "))
    .eq("id", request.store_id)
    .single();

  const { error: updateError } = await supabase
    .from("stores")
    .update(updatePayload)
    .eq("id", request.store_id);
  if (updateError) throw new Error(updateError.message);

  for (const key of Object.keys(proposed)) {
    await recordStoreHistory(supabase, {
      storeId: request.store_id,
      actorType: "admin",
      actorLabel: reviewerUserId,
      field: key,
      oldValue: (existing as Record<string, unknown> | null)?.[key] ?? null,
      newValue: proposed[key],
    });
  }

  await supabase
    .from("store_change_requests")
    .update({
      status: "approved",
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  return { storeId: request.store_id as string, field: request.field as "name" | "address" };
}

export async function rejectStoreChangeRequest(
  supabase: AnySupabaseClient,
  requestId: string,
  reviewerUserId: string,
  note: string | null
): Promise<{ storeId: string | null }> {
  const { data: updated, error } = await supabase
    .from("store_change_requests")
    .update({
      status: "rejected",
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
      review_note: note,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("store_id")
    .maybeSingle();
  if (error) throw new Error(error.message);

  return { storeId: (updated?.store_id as string | undefined) ?? null };
}
