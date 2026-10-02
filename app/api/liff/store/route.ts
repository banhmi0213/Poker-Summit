import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { authenticateLiffRequest } from "@/lib/liff-auth";
import {
  applyInstantStoreFieldsUpdate,
  hasPendingStoreChangeRequest,
  requestStoreFieldChange,
} from "@/lib/store-update";

type StoreUpdateBody = {
  name?: string;
  category?: string | null;
  pref?: string;
  city?: string;
  address?: string;
  tel?: string;
  hours?: string;
  nearestStation?: string;
  description?: string;
  lineUrl?: string | null;
  areaKeywords?: string | null;
};

// Same input → confirm → save flow as the web portal's updateStoreProfile,
// just driven by the LIFF form instead of an HTML <form>. Name/address are
// never written directly — they become store_change_requests rows awaiting
// admin approval, exactly like the web side, so search/map/geocoding data
// can't drift out of sync no matter which channel the owner edits from.
export async function PATCH(req: NextRequest) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId, lineUserId } = auth;

  let body: StoreUpdateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const { data: current, error: fetchError } = await supabase
    .from("stores")
    .select("id, name, pref, city, address")
    .eq("id", storeId)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "店舗情報を取得できませんでした。" }, { status: 500 });
  }

  const requestedBy = `line:${lineUserId}`;

  try {
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: "店舗名を入力してください。" }, { status: 400 });
      }
      if (name !== (current.name ?? "")) {
        if (await hasPendingStoreChangeRequest(supabase, storeId, "name")) {
          return NextResponse.json(
            { error: "店舗名の変更はすでに運営の承認待ちです。承認され次第、反映されます。" },
            { status: 409 }
          );
        }
        await requestStoreFieldChange(supabase, {
          storeId,
          field: "name",
          currentValue: { name: current.name },
          proposedValue: { name },
          requestedBy,
        });
      }
    }

    const addressTouched =
      body.pref !== undefined || body.city !== undefined || body.address !== undefined;
    if (addressTouched) {
      const pref = (body.pref ?? current.pref ?? "").trim();
      const city = (body.city ?? current.city ?? "").trim();
      const address = (body.address ?? current.address ?? "").trim();
      const addressChanged =
        pref !== (current.pref ?? "") || city !== (current.city ?? "") || address !== (current.address ?? "");

      if (addressChanged) {
        if (await hasPendingStoreChangeRequest(supabase, storeId, "address")) {
          return NextResponse.json(
            { error: "住所の変更はすでに運営の承認待ちです。承認され次第、反映されます。" },
            { status: 409 }
          );
        }
        await requestStoreFieldChange(supabase, {
          storeId,
          field: "address",
          currentValue: { pref: current.pref, city: current.city, address: current.address },
          proposedValue: { pref: pref || null, city: city || null, address: address || null },
          requestedBy,
        });
      }
    }

    await applyInstantStoreFieldsUpdate(supabase, storeId, "line", requestedBy, {
      category: body.category,
      tel: body.tel,
      hours: body.hours,
      nearestStation: body.nearestStation,
      description: body.description,
      lineUrl: body.lineUrl,
      areaKeywords: body.areaKeywords,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "更新に失敗しました。" },
      { status: 500 }
    );
  }

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/admin/stores");

  return NextResponse.json({ ok: true });
}
