import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { searchPlaces, type PlaceCandidate } from "@/lib/google-places";
import { distanceKm } from "@/lib/geocode";

// 掲載店舗をGoogleマップの場所(place_id)と結びつける。
// 店名+市区町村でGoogleを検索し、名前の近さと所在地で一番それらしい候補を選ぶ。
// 結果は stores.google_match_status に残す:
//   matched     … 結びつけ済み(google_place_id / 緯度経度 / 営業状況を保存)
//   ambiguous   … 候補はあるが自信がない(運営が確認)
//   not_found   … Googleに見つからない(閉店・架空の可能性)
//   duplicate   … 同じ場所が別の店舗にすでに結びついている(重複登録の可能性)
//   error       … 検索に失敗(次回やり直し)

export type MatchStatus = "matched" | "ambiguous" | "not_found" | "duplicate" | "error";

type StoreRow = {
  id: string;
  name: string;
  pref: string | null;
  city: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

function normalize(s: string) {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　・･\-－‐_.,、。'"’“”!！?？()（）［］\[\]「」『』【】&＆+/]/g, "");
}

function bigrams(s: string) {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out.length ? out : [s];
}

/** 店名の近さ(0〜1)。片方がもう片方を含む場合は高めに評価する。 */
export function nameSimilarity(a: string, b: string) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const ax = bigrams(x);
  const by = bigrams(y);
  const pool = [...by];
  let hit = 0;
  for (const g of ax) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  return (2 * hit) / (ax.length + by.length);
}

function scoreCandidate(store: StoreRow, c: PlaceCandidate) {
  const nameScore = nameSimilarity(store.name, c.name);
  const addr = (c.address ?? "").normalize("NFKC");
  const prefOk = !store.pref || addr.includes(store.pref);
  const cityOk = !store.city || addr.includes(store.city.normalize("NFKC"));
  let distanceOk = true;
  if (store.lat != null && store.lng != null && c.lat != null && c.lng != null) {
    distanceOk = distanceKm(store.lat, store.lng, c.lat, c.lng) <= 3;
  }
  let score = nameScore;
  if (!prefOk) score -= 0.5;
  if (!cityOk) score -= 0.15;
  if (!distanceOk) score -= 0.3;
  return { score, nameScore, prefOk, cityOk, distanceOk };
}

export async function matchStoreToGoogle(store: StoreRow): Promise<{ status: MatchStatus; candidate?: PlaceCandidate; note: string }> {
  const place = `${store.pref ?? ""}${store.city ?? ""}`;
  let candidates: PlaceCandidate[];
  try {
    candidates = await searchPlaces(`${store.name} ${place}`, 1);
    if (!candidates.length && store.address) {
      candidates = await searchPlaces(`${store.name} ${store.address}`, 1);
    }
  } catch (e) {
    return { status: "error", note: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
  if (!candidates.length) return { status: "not_found", note: "Googleマップで見つかりません" };

  const ranked = candidates
    .map((c) => ({ c, ...scoreCandidate(store, c) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const note = `候補「${best.c.name}」${best.c.address ?? ""}(名前の一致度 ${Math.round(best.nameScore * 100)}%) place_id:${best.c.placeId}`;

  if (best.score >= 0.6 && best.prefOk) return { status: "matched", candidate: best.c, note };
  if (best.score >= 0.35 && best.prefOk) return { status: "ambiguous", candidate: best.c, note };
  return { status: "not_found", candidate: best.c, note: `一致する候補なし。最も近い${note}` };
}

/** 未確認の店舗を limit 件ずつ照合して保存する。戻り値は今回の結果と残り件数。 */
export async function matchNextStores(limit = 15) {
  const svc = createServiceRoleClient();
  const { data: rows } = await svc
    .from("stores")
    .select("id, name, pref, city, address, lat, lng")
    .in("status", ["approved", "listed", "pending"])
    .is("google_place_id", null)
    .is("google_checked_at", null)
    .order("created_at")
    .limit(limit);

  const results: Array<{ id: string; name: string; status: MatchStatus; note: string }> = [];
  const queue = [...((rows ?? []) as StoreRow[])];
  const worker = async () => {
    for (let store = queue.shift(); store; store = queue.shift()) {
      const m = await matchStoreToGoogle(store);
      let status = m.status;
      const update: Record<string, unknown> = {
        google_checked_at: status === "error" ? null : new Date().toISOString(),
        google_match_note: m.note,
      };
      if (m.candidate) update.google_business_status = m.candidate.businessStatus;
      if (status === "matched" && m.candidate) {
        const { data: taken } = await svc
          .from("stores")
          .select("id, name")
          .eq("google_place_id", m.candidate.placeId)
          .neq("id", store.id)
          .maybeSingle();
        if (taken) {
          status = "duplicate";
          update.google_match_note = `同じ場所が「${taken.name}」(${taken.id})に結びついています。${m.note}`;
        } else {
          update.google_place_id = m.candidate.placeId;
          if (m.candidate.lat != null && m.candidate.lng != null) {
            update.lat = m.candidate.lat;
            update.lng = m.candidate.lng;
          }
        }
      }
      update.google_match_status = status;
      if (status === "error") {
        // 検索に失敗したものは、今回の処理対象から外すだけ(次の呼び出しで再挑戦はしない)
        update.google_checked_at = new Date().toISOString();
      }
      await svc.from("stores").update(update).eq("id", store.id);
      results.push({ id: store.id, name: store.name, status, note: String(update.google_match_note ?? "") });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  const { count: remaining } = await svc
    .from("stores")
    .select("id", { count: "exact", head: true })
    .in("status", ["approved", "listed", "pending"])
    .is("google_place_id", null)
    .is("google_checked_at", null);

  return { results, remaining: remaining ?? 0 };
}
