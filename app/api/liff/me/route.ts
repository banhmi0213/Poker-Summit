import { NextRequest, NextResponse } from "next/server";
import { authenticateLiffRequest } from "@/lib/liff-auth";

// Returns the linked store's editable profile plus any pending name/address
// change requests, so the LIFF dashboard can show "承認待ち" banners just
// like the web portal does. Operator-only fields (id/status/owner) are
// included read-only for display — never accepted back on a write.
export async function GET(req: NextRequest) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId } = auth;

  const [{ data: store, error: storeError }, { data: pendingRequests }] = await Promise.all([
    supabase
      .from("stores")
      .select(
        "id, name, category, region, pref, city, address, tel, hours, description, line_url, area_keywords, status"
      )
      .eq("id", storeId)
      .single(),
    supabase
      .from("store_change_requests")
      .select("id, field, proposed_value, requested_at")
      .eq("store_id", storeId)
      .eq("status", "pending"),
  ]);

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  return NextResponse.json({ store, pendingRequests: pendingRequests ?? [] });
}
