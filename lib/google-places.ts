// Google Places API (Legacy, Text Search / Place Details) wrapper。
//
// 「地方ごとにGoogle Placesから店舗候補を取り込む」運営向け機能
// (app/admin/stores/import)専用。GOOGLE_PLACES_API_KEYはGoogle Cloud側で
// Places APIのみにスコープ制限したキーをVercelの環境変数に設定して使う
// (2026/10)。未設定の環境では例外を投げる(インポート機能自体を使わない
// 限り他の機能には影響しない)。
//
// 取り込みは「全部自動で公開」ではなく「pendingで仮登録→運営が目視確認して
// 承認」という運用にするため(店名にたまたまキーワードが入っているだけの
// 無関係な店、閉店済みの店が混ざる可能性があるため)、ここでは検索結果を
// 返すだけで、DBへの書き込みはapp/admin/stores/import/actions.ts側で行う。

export type PlaceCandidate = {
  placeId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  businessStatus: string | null;
  types: string[];
};

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY が設定されていません。Vercelの環境変数を確認してください。"
    );
  }
  return key;
}

// Text Search (Legacy) は1ページ最大20件、next_page_tokenで最大60件まで
// 追跡できる。Googleの仕様上、トークン発行直後は少し待たないと
// INVALID_REQUESTになることがあるため、ページ間に短い待機を入れる。
export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const apiKey = getApiKey();
  const results: PlaceCandidate[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < 3; page++) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("language", "ja");
    url.searchParams.set("region", "jp");
    if (pageToken) {
      url.searchParams.set("pagetoken", pageToken);
    } else {
      url.searchParams.set("query", query);
    }

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places API error: ${data.status} ${data.error_message ?? ""}`);
    }

    for (const r of data.results ?? []) {
      if (!r.place_id || !r.name) continue;
      results.push({
        placeId: r.place_id,
        name: r.name,
        address: r.formatted_address ?? null,
        lat: r.geometry?.location?.lat ?? null,
        lng: r.geometry?.location?.lng ?? null,
        businessStatus: r.business_status ?? null,
        types: r.types ?? [],
      });
    }

    pageToken = data.next_page_token ?? null;
    if (!pageToken) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return results;
}

export type PlaceDetails = {
  tel: string | null;
  city: string | null;
};

// Text Search のレスポンスには電話番号・市区町村(住所の構成要素)が
// 含まれないため、取り込み確定時にPlace Detailsを1件ずつ叩いて補完する
// (fieldsを絞ることで課金対象データを最小限にする)。失敗してもnullの
// ままにするだけで取り込み自体は止めない(lib/geocode.tsと同じ
// ベストエフォート方針)。市区町村はaddress_componentsの中から
// locality(市区町村)→sublocality_level_1(東京23区などlocalityが
// 無いケース)→administrative_area_level_2(郡など)の優先順で拾う
// (2026/10、「市区町村が反映されてない」との指摘を受けて追加)。
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  try {
    const apiKey = getApiKey();
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("language", "ja");
    url.searchParams.set("fields", "formatted_phone_number,address_component");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    const components: Array<{ long_name: string; types: string[] }> =
      data.result?.address_components ?? [];
    const byType = (type: string) =>
      components.find((c) => c.types?.includes(type))?.long_name ?? null;
    const city =
      byType("locality") ?? byType("sublocality_level_1") ?? byType("administrative_area_level_2");

    return {
      tel: data.result?.formatted_phone_number ?? null,
      city,
    };
  } catch {
    return { tel: null, city: null };
  }
}

// Google PlacesにはCATEGORY_LABEL(アミューズメントポーカー/ポーカーバー/
// カジノバー/リングのみ/トーナメントのみ/ポーカースクール/その他)に対応
// する情報が無いため、店名とGoogleのtypesからベストエフォートで推測する。
// あくまで下書きなので、違っていれば承認時に運営が直し、必要なければ
// 「その他」のままでよい(2026/10、「カテゴリも」との指摘を受けて追加)。
export function guessCategory(name: string, types: string[]): string {
  const n = name.toLowerCase();
  if (n.includes("スクール") || n.includes("school") || n.includes("教室")) return "school";
  if (n.includes("カジノ") || n.includes("casino")) return "casino";
  if (n.includes("アミューズメント") || n.includes("amusement")) return "amusement";
  if (n.includes("トーナメント") || n.includes("tournament") || n.includes("大会")) return "tournament";
  if (n.includes("バー") || n.includes("bar") || types.includes("bar") || types.includes("night_club")) {
    return "bar";
  }
  return "other";
}
