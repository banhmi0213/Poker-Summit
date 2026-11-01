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
//
// 2026/10追記: 北海道検索の全滅原因はGoogle側のINVALID_REQUEST(pagetoken
// 未有効化)だった。2ページ目以降でこれが出てもキーワード全体を失敗させず、
// 1回だけ再試行して打ち切る(初回ページの失敗のみ例外を投げる)。
export async function searchPlaces(query: string, maxPages = 3): Promise<PlaceCandidate[]> {
  const apiKey = getApiKey();
  const results: PlaceCandidate[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("language", "ja");
    url.searchParams.set("region", "jp");
    if (pageToken) {
      url.searchParams.set("pagetoken", pageToken);
    } else {
      url.searchParams.set("query", query);
    }

    let res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    let data = await res.json();

    if (page > 0 && data.status === "INVALID_REQUEST") {
      // pagetoken発行直後でまだ有効化されていない可能性があるので、もう少し
      // 待ってから1回だけ再試行する。
      await new Promise((resolve) => setTimeout(resolve, 2000));
      res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
      data = await res.json();
    }

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      if (page === 0) {
        throw new Error(`Google Places API error: ${data.status} ${data.error_message ?? ""}`);
      }
      // 2ページ目以降の失敗はそのキーワードの取りこぼしで済ませ、検索全体は
      // 失敗させない(ここまでに集まった分だけ返す)。
      break;
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

export type PlaceReviewDetails = {
  name: string | null;
  address: string | null;
  tel: string | null;
  city: string | null;
  businessStatus: string | null;
  types: string[];
  hoursText: string[] | null;
  hoursPeriods: unknown[] | null;
  /** 公式サイト・SNS(Googleマップに載っているもの) */
  website: string | null;
  /** 口コミの件数 */
  ratingsTotal: number;
  /** 新しい順の口コミ(最大5件)。time はUNIX秒 */
  reviews: { time: number; text: string }[];
  notFound: boolean;
};

/**
 * 自動見直しで見つけた店を掲載してよいか確かめるための詳細(2026/10/20)。
 * Googleマップの今の情報(店名・住所・電話番号・営業時間・営業状況)を1回でまとめて取る。
 * 電話番号・営業時間は「Contact Data」の枠を使うので、呼び出し回数は営業時間の月間上限と一緒に数える。
 * 通信エラーなどで取れなければ null(次回やり直し)。
 */
export async function getPlaceReviewDetails(placeId: string): Promise<PlaceReviewDetails | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("key", getApiKey());
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("language", "ja");
    url.searchParams.set(
      "fields",
      "name,formatted_address,address_component,formatted_phone_number,business_status,type,opening_hours,website,user_ratings_total,reviews"
    );
    // 口コミは新しい順で取る(最近ポーカーをやっている裏付けに使う、2026/10/21)
    url.searchParams.set("reviews_sort", "newest");
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (data.status === "NOT_FOUND") {
      return { name: null, address: null, tel: null, city: null, businessStatus: "NOT_FOUND", types: [], hoursText: null, hoursPeriods: null, website: null, ratingsTotal: 0, reviews: [], notFound: true };
    }
    if (data.status !== "OK") return null;
    const r = data.result ?? {};
    const components: Array<{ long_name: string; types: string[] }> = r.address_components ?? [];
    const byType = (type: string) => components.find((c) => c.types?.includes(type))?.long_name ?? null;
    const oh = r.opening_hours;
    return {
      name: r.name ?? null,
      address: r.formatted_address ?? null,
      tel: r.formatted_phone_number ?? null,
      city: byType("locality") ?? byType("sublocality_level_1") ?? byType("administrative_area_level_2"),
      businessStatus: r.business_status ?? null,
      types: r.types ?? [],
      hoursText: Array.isArray(oh?.weekday_text) && oh.weekday_text.length ? oh.weekday_text : null,
      hoursPeriods: Array.isArray(oh?.periods) && oh.periods.length ? oh.periods : null,
      website: r.website ?? null,
      ratingsTotal: Number(r.user_ratings_total ?? 0) || 0,
      reviews: Array.isArray(r.reviews) ? r.reviews.map((v: { time?: number; text?: string }) => ({ time: Number(v.time ?? 0), text: String(v.text ?? "") })) : [],
      notFound: false,
    };
  } catch {
    return null;
  }
}

/** 営業状況だけを取る(閉業チェック用)。取れなければ null。 */
export async function getPlaceBusinessStatus(placeId: string): Promise<string | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("key", getApiKey());
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "business_status");
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (data.status === "NOT_FOUND") return "NOT_FOUND";
    return data.result?.business_status ?? null;
  } catch {
    return null;
  }
}

export type PlaceOpeningHours = {
  /** 「月曜日: 18時00分～2時00分」のような曜日ごとの表示用文字列(月曜始まり) */
  weekdayText: string[] | null;
  /** Googleの periods(曜日0=日曜、"HHMM")。構造化データ用 */
  periods: unknown[] | null;
  businessStatus: string | null;
  notFound: boolean;
};

/**
 * 営業時間を取る(2026/10)。opening_hours は「Contact Data」SKU(毎月1,000回まで無料)で
 * 課金されるので、呼び出す回数は lib/google-hours.ts の月間上限で管理する。
 */
export async function getPlaceOpeningHours(placeId: string): Promise<PlaceOpeningHours | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("key", getApiKey());
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("language", "ja");
    url.searchParams.set("fields", "opening_hours,business_status");
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (data.status === "NOT_FOUND") return { weekdayText: null, periods: null, businessStatus: "NOT_FOUND", notFound: true };
    if (data.status !== "OK") return null;
    const oh = data.result?.opening_hours;
    return {
      weekdayText: Array.isArray(oh?.weekday_text) && oh.weekday_text.length ? oh.weekday_text : null,
      periods: Array.isArray(oh?.periods) && oh.periods.length ? oh.periods : null,
      businessStatus: data.result?.business_status ?? null,
      notFound: false,
    };
  } catch {
    return null;
  }
}
