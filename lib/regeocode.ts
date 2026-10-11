import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { geocodeAddress } from "@/lib/geocode";

// 店舗の座標(lat/lng)を国土地理院の住所検索で取り直す。
// Google Places の座標は利用規約上30日を超えて保存できないため、保存する座標は
// すべて国土地理院(保存・再利用が自由)のものにそろえる。stores.geo_source = 'gsi' が取り直し済み。

export async function regeocodeNextStores(limit = 40) {
  const svc = createServiceRoleClient();
  const { data: rows } = await svc
    .from("stores")
    .select("id, pref, city, address")
    .in("status", ["approved", "listed", "pending"])
    .is("geo_source", null)
    .order("created_at")
    .limit(limit);

  let ok = 0;
  let failed = 0;
  const queue = [...(rows ?? [])] as Array<{ id: string; pref: string | null; city: string | null; address: string | null }>;
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      // 建物名・階数まで付けると見つからないことがあるので、だめなら番地までで再検索
      let geo = await geocodeAddress(s.pref, s.city, s.address);
      if (!geo && s.address) {
        const short = s.address.trim().replace(/\s.*$/, "");
        if (short && short !== s.address.trim()) geo = await geocodeAddress(s.pref, s.city, short);
      }
      if (geo) {
        ok++;
        await svc.from("stores").update({ lat: geo.lat, lng: geo.lng, geo_source: "gsi" }).eq("id", s.id);
      } else {
        // 取れなかった店は座標を空にする(Google由来の座標を残さない)
        failed++;
        await svc.from("stores").update({ lat: null, lng: null, geo_source: "gsi_failed" }).eq("id", s.id);
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  const { count: remaining } = await svc
    .from("stores")
    .select("id", { count: "exact", head: true })
    .in("status", ["approved", "listed", "pending"])
    .is("geo_source", null);
  return { processed: (rows ?? []).length, ok, failed, remaining: remaining ?? 0 };
}
