import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  const { data: banner } = await supabase
    .from("banners")
    .select("id, link_url, active")
    .eq("id", params.id)
    .maybeSingle();

  const referrer = request.headers.get("referer") ?? null;

  await supabase.from("banner_clicks").insert({
    banner_id: params.id,
    referrer,
  });

  const dest = banner?.active && banner.link_url ? banner.link_url : "/";
  return NextResponse.redirect(new URL(dest, request.url));
}
