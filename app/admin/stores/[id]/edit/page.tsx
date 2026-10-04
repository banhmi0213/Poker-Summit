import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateStoreByAdmin } from "../../actions";
import { HoursInput } from "@/app/hours-input";
import {
  STORE_STATUS_LABEL as STATUS_LABEL,
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  REGIONS,
  PREF_OPTIONS,
} from "@/lib/constants";

// 従来は /admin/stores の一覧テーブル内(操作列、幅220px)に<details>で
// インライン展開していたが、項目数が多く使いにくいとの指摘(2026/09/30)を
// 受けて、独立した編集ページに分離した。他の管理画面
// (app/admin/members/[id]、app/admin/contracts/[id])と同じ
// 「一覧 → 詳細/編集ページへ遷移」のパターンに合わせている。
export default async function AdminStoreEditPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select(
      "id, name, category, region, pref, city, address, tel, hours, nearest_station, description, area_keywords, status"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!store) {
    notFound();
  }

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>{store.name} を編集</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            <span className="badge outline" style={{ marginRight: 6 }}>
              {CATEGORY_LABEL[store.category ?? ""] ?? store.category ?? "カテゴリ未設定"}
            </span>
            <span className="badge">{STATUS_LABEL[store.status] ?? store.status}</span>
          </div>
        </div>
        <Link href="/admin/stores" className="btn">
          ← 店舗一覧へ戻る
        </Link>
      </div>

      <div className="card">
        <form
          action={updateStoreByAdmin}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          <input type="hidden" name="storeId" value={store.id} />

          <div className="field">
            <span className="muted">店舗名 *</span>
            <input type="text" name="name" defaultValue={store.name} required />
          </div>

          <div className="field">
            <span className="muted">カテゴリ</span>
            <select name="category" defaultValue={store.category === "other" ? "" : store.category ?? ""}>
              <option value="">未設定</option>
              {CATEGORY_OPTIONS.filter((c) => c.value !== "other").map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="muted">都道府県</span>
            <select name="pref" defaultValue={store.pref ?? ""}>
              <option value="">未設定</option>
              {PREF_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="muted">地方</span>
            <select name="region" defaultValue={store.region ?? ""}>
              <option value="">未設定</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="muted">市区町村</span>
            <input type="text" name="city" defaultValue={store.city ?? ""} />
          </div>

          <div className="field">
            <span className="muted">住所</span>
            <input type="text" name="address" defaultValue={store.address ?? ""} />
          </div>

          <div className="field">
            <span className="muted">最寄り駅</span>
            <input
              type="text"
              name="nearestStation"
              placeholder="例: 梅田駅 徒歩5分"
              defaultValue={store.nearest_station ?? ""}
            />
          </div>

          <div className="field">
            <span className="muted">電話番号</span>
            <input type="text" name="tel" defaultValue={store.tel ?? ""} />
          </div>

          <div className="field">
            <span className="muted">営業時間</span>
            <HoursInput initialValue={store.hours} />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="muted">検索キーワード（検索用・任意）</span>
            <input
              type="text"
              name="areaKeywords"
              placeholder="例: ミナミ アメ村 心斎橋 駅近 駐車場あり パーキングあり"
              defaultValue={store.area_keywords ?? ""}
            />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="muted">紹介文</span>
            <textarea name="description" rows={4} defaultValue={store.description ?? ""} />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button type="submit" className="btn primary">
              保存する
            </button>
            <Link href="/admin/stores" className="btn">
              キャンセル
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
