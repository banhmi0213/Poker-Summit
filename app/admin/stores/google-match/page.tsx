import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GoogleMatchRunner, RegeocodeRunner } from "./runner";
import { resolveGoogleMatch, resetGoogleMatch } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  matched: "結びつけ済み",
  ambiguous: "要確認(候補あり)",
  not_found: "Googleに見つからない",
  duplicate: "重複の可能性",
  error: "検索エラー",
  checked_by_admin: "運営が確認済み",
  hidden_by_admin: "非公開にした",
};

const BUSINESS_LABEL: Record<string, string> = {
  OPERATIONAL: "営業中",
  CLOSED_TEMPORARILY: "臨時休業",
  CLOSED_PERMANENTLY: "閉業",
};

type Row = {
  id: string;
  name: string;
  pref: string | null;
  city: string | null;
  address: string | null;
  status: string;
  google_place_id: string | null;
  google_match_status: string | null;
  google_business_status: string | null;
  google_match_note: string | null;
};

export default async function GoogleMatchPage() {
  const supabase = await createClient();
  const ACTIVE = ["approved", "listed", "pending"];
  const [{ count: remaining }, { count: linked }, { data: review }, { count: geoRemaining }] = await Promise.all([
    supabase.from("stores").select("id", { count: "exact", head: true }).in("status", ACTIVE).is("google_place_id", null).is("google_checked_at", null),
    supabase.from("stores").select("id", { count: "exact", head: true }).in("status", ACTIVE).not("google_place_id", "is", null),
    supabase
      .from("stores")
      .select("id, name, pref, city, address, status, google_place_id, google_match_status, google_business_status, google_match_note")
      .in("status", ["approved", "listed", "pending"])
      .or("google_match_status.in.(ambiguous,not_found,duplicate,error),google_business_status.in.(CLOSED_PERMANENTLY,CLOSED_TEMPORARILY)")
      .order("google_match_status")
      .limit(500),
    supabase.from("stores").select("id", { count: "exact", head: true }).is("geo_source", null),
  ]);
  const rows = (review ?? []) as Row[];

  return (
    <div className="container">
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Googleマップとの照合</h1>
      <p className="muted" style={{ marginBottom: 16, fontSize: 13.5 }}>
        掲載店舗をGoogleマップの場所と結びつけます。結びつけた店舗は、店舗ページの「地図・経路を見る」がGoogleマップの正しい場所で開きます。
        Googleで「閉業」になっている店舗や見つからない店舗は、下の一覧で確認してください。(結びつけ済み: {linked ?? 0}件)
      </p>

      <RegeocodeRunner remaining={geoRemaining ?? 0} />
      <GoogleMatchRunner remaining={remaining ?? 0} />

      <h2 style={{ fontSize: 16, margin: "20px 0 8px" }}>確認が必要な店舗({rows.length}件)</h2>
      {rows.length === 0 && <p className="muted">いまのところありません。</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => {
          const candidatePlaceId = r.google_match_note?.match(/place_id:([\w-]+)/)?.[1] ?? null;
          return (
            <div key={r.id} className="card" style={{ fontSize: 13.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <strong>{r.name}</strong>
                  <span className="muted"> {r.pref}{r.city} {r.address}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="badge">{STATUS_LABEL[r.google_match_status ?? ""] ?? r.google_match_status ?? "-"}</span>
                  {r.google_business_status && (
                    <span className="badge" style={r.google_business_status === "CLOSED_PERMANENTLY" ? { background: "#fde2e1", color: "#b42318" } : {}}>
                      Google: {BUSINESS_LABEL[r.google_business_status] ?? r.google_business_status}
                    </span>
                  )}
                </div>
              </div>
              {r.google_match_note && <p className="muted" style={{ marginTop: 6 }}>{r.google_match_note.replace(/\s*place_id:[\w-]+/, "")}</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <Link href={`/stores/${r.id}`} target="_blank" className="btn" style={{ fontSize: 12 }}>店舗ページ</Link>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.pref ?? ""}${r.city ?? ""}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ fontSize: 12 }}
                >
                  Googleマップで探す
                </a>
                {candidatePlaceId && !r.google_place_id && (
                  <form action={resolveGoogleMatch}>
                    <input type="hidden" name="storeId" value={r.id} />
                    <input type="hidden" name="placeId" value={candidatePlaceId} />
                    <button name="action" value="confirm" className="btn primary" style={{ fontSize: 12 }}>この候補で結びつける</button>
                  </form>
                )}
                <form action={resolveGoogleMatch}>
                  <input type="hidden" name="storeId" value={r.id} />
                  <button name="action" value="keep" className="btn" style={{ fontSize: 12 }}>問題なし(確認済み)</button>
                </form>
                <form action={resolveGoogleMatch}>
                  <input type="hidden" name="storeId" value={r.id} />
                  <button name="action" value="hide" className="btn" style={{ fontSize: 12, color: "#b42318" }}>非公開にする</button>
                </form>
                {!r.google_place_id && (
                  <form action={resetGoogleMatch}>
                    <input type="hidden" name="storeId" value={r.id} />
                    <button className="btn" style={{ fontSize: 12 }}>照合をやり直す</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
