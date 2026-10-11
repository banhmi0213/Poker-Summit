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

/**
 * 住所を「町名+番地」までの比較用キーにする。
 * 例: 「〒516-0073 三重県伊勢市吹上１丁目５−２０ AKATSUKI BLD」→「伊勢市吹上1-5-20」
 * 郵便番号・都道府県・建物名・階数は落とす。番地が取れなければ null。
 */
export function addressKey(address: string | null | undefined): string | null {
  if (!address) return null;
  let s = address
    .normalize("NFKC")
    .replace(/^日本[、,]?\s*/, "")
    .replace(/〒?\s*\d{3}[-‐‑‒–—―−ーｰ－]?\d{4}/, "")
    .replace(/(\d)\s*(?:丁目|番地|番|の)\s*(?=\d)/g, "$1-")
    .replace(/(\d)\s*[‐‑‒–—―−ーｰ－-]\s*(?=\d)/g, "$1-")
    .replace(/(\d)(?:丁目|番地|番|号)/g, "$1")
    .trim()
    .replace(/^.{2,3}?[都道府県]/, "");
  // 建物名・階数は空白の後ろに来るので、番地は空白の手前までで切る
  const m = s.match(/^([^\d\s]+?)\s*(\d+(?:-\d+)*)/);
  if (!m) return null;
  s = `${m[1].replace(/\s+/g, "")}${m[2].replace(/-+$/, "")}`;
  return s;
}

/** 町名と番地(先頭2つ以上の数字)が一致するか。片方の番地が短い場合は前方一致で見る。 */
export function sameAddress(a: string | null | undefined, b: string | null | undefined) {
  const x = addressKey(a);
  const y = addressKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const nums = short.match(/\d+(?:-\d+)*$/)?.[0].split("-").length ?? 0;
  return nums >= 2 && long.startsWith(`${short}-`);
}

const GENERIC_WORDS = /poker|room|bar|casino|amusement|cafe|club|house|lounge|shisha|darts|the|ポーカー|カジノ|バー|アミューズメント|店/g;

/**
 * 両方の店名に英字の固有名(「poker」「bar」等のありふれた語を除く)があるのに、まったく似ていないか。
 * 例: 「POKER ROOM GOKIN 船橋」と「Poker Room Arkadia 船橋店」→ 店名変更や同じビルの別店舗の可能性。
 * 片方がカタカナ表記(「Jack&Queen」と「ジャック＆クイーン」)の場合は判断しない。
 */
function latinNamesDiffer(a: string, b: string) {
  const latin = (s: string) => (normalize(s).replace(GENERIC_WORDS, "").match(/[a-z0-9]+/g) ?? []).join("");
  const x = latin(a);
  const y = latin(b);
  if (x.length < 3 || y.length < 3) return false;
  return nameSimilarity(x, y) < 0.2;
}

function scoreCandidate(store: StoreRow, c: PlaceCandidate) {
  const nameScore = nameSimilarity(store.name, c.name);
  const addressOk = sameAddress(store.address, c.address);
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
  // 住所(町名+番地)が一致すれば、名前の表記揺れ(英語/カタカナ、Google側の宣伝文句付き店名)は許容する。
  // ただし両方に英字の店名があるのにまったく違う場合は、店名変更や同じビルの別店舗の可能性があるので確認に回す。
  const differentLatinNames = latinNamesDiffer(store.name, c.name);
  if (addressOk && !differentLatinNames) score = Math.max(score, 0.8);
  return { score, nameScore, prefOk, cityOk, distanceOk, addressOk };
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
  const note = `候補「${best.c.name}」${best.c.address ?? ""}(名前の一致度 ${Math.round(best.nameScore * 100)}%${best.addressOk ? "・住所一致" : ""}) place_id:${best.c.placeId}`;

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
