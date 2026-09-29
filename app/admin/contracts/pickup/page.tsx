import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PREF_OPTIONS } from "@/lib/constants";
import { PICKUP_PER_PREF_LIMIT } from "@/lib/contracts";
import { setStoreRecommended } from "../../stores/actions";

// 都道府県別PICK UP契約(各県最大10店舗)の埋まり具合と、割当/解除。
// PICK UP自体は新しいテーブルを持たず、既存の stores.is_recommended フラグ
// を都道府県ごとに数えているだけ — 表示は都道府県区切りだが、TOPページ側の
// 実際の絞り込みロジック(app/page.tsx)とは完全に同じデータソースを見ている。
export default async function PickupContractsPage() {
  const supabase = await createClient();

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, pref, is_recommended")
    .in("status", ["approved", "listed"])
    .order("name", { ascending: true });

  const byPref = new Map<string, { id: string; name: string; is_recommended: boolean }[]>();
  for (const pref of PREF_OPTIONS) byPref.set(pref, []);
  for (const s of stores ?? []) {
    if (s.pref && byPref.has(s.pref)) {
      byPref.get(s.pref)!.push(s);
    }
  }

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22 }}>都道府県別PICK UP契約</h1>
        <Link href="/admin/contracts" className="btn">
          契約一覧に戻る
        </Link>
      </div>

      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        各都道府県、PICK UP契約は最大{PICKUP_PER_PREF_LIMIT}店舗までです。上限に達している都道府県は新規追加の前に既存の枠を解除してください。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PREF_OPTIONS.map((pref) => {
          const prefStores = byPref.get(pref) ?? [];
          const assigned = prefStores.filter((s) => s.is_recommended);
          const available = prefStores.filter((s) => !s.is_recommended);
          const isFull = assigned.length >= PICKUP_PER_PREF_LIMIT;

          return (
            <details key={pref} className="card">
              <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>{pref}</span>
                <span
                  className={`badge ${isFull ? "" : "outline"}`}
                  style={isFull ? { background: "#d1453b", borderColor: "#d1453b", color: "#fff" } : undefined}
                >
                  {assigned.length}/{PICKUP_PER_PREF_LIMIT}
                </span>
              </summary>

              <div style={{ marginTop: 12 }}>
                <h3 style={{ fontSize: 13, marginBottom: 6 }}>契約中の店舗</h3>
                {assigned.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>まだありません。</p>}
                {assigned.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                    {assigned.map((s) => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                        <span>{s.name}</span>
                        <form
                          action={async () => {
                            "use server";
                            await setStoreRecommended(s.id, false);
                          }}
                        >
                          <button type="submit" className="btn" style={{ fontSize: 12 }}>
                            解除
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}

                <h3 style={{ fontSize: 13, marginBottom: 6 }}>追加できる店舗</h3>
                {available.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>この都道府県に他の掲載店舗はありません。</p>}
                {available.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {available.map((s) => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                        <span>{s.name}</span>
                        <form
                          action={async () => {
                            "use server";
                            await setStoreRecommended(s.id, true);
                          }}
                        >
                          <button type="submit" className="btn primary" style={{ fontSize: 12 }} disabled={isFull}>
                            追加
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
