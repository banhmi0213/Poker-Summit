import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { authenticateLiffRequest } from "@/lib/liff-auth";
import { recordStoreHistory } from "@/lib/store-update";

const PHOTOS_BUCKET = "store-photos";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId, lineUserId } = auth;

  const { data: photo, error: fetchError } = await supabase
    .from("store_photos")
    .select("id, url, storage_path")
    .eq("id", params.id)
    .eq("store_id", storeId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!photo) return NextResponse.json({ error: "写真が見つかりません。" }, { status: 404 });

  const { error: deleteError } = await supabase
    .from("store_photos")
    .delete()
    .eq("id", params.id)
    .eq("store_id", storeId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (photo.storage_path) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);
  }

  await recordStoreHistory(supabase, {
    storeId,
    actorType: "line",
    actorLabel: `line:${lineUserId}`,
    field: "photo_deleted",
    oldValue: { id: photo.id, url: photo.url },
    newValue: null,
  });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);

  return NextResponse.json({ ok: true });
}
