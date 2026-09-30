import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { createMenuItem, updateMenuItem, toggleMenuItemStatus, deleteMenuItem } from "../menu-actions";

// 店舗独自の料金・メニュー(参加費・レイト・ドリンク等)を店舗オーナーが
// 管理できるページ。運営側の「プラン・アップグレード」(Poker Summit
// 利用料金)とは別物で、来店客向けに店舗詳細ページへ掲載する料金表
// (2026/09/30、「料金・メニューな」「一覧に追加」との指示により新設)。
export default async function StoreMenuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/store/login?next=/store/profile/menu");
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!store) {
    return (
      <div className="container">
        <p className="err">このアカウントに紐づく店舗が見つかりません。運営に店舗オーナーとしての登録を依頼してください。</p>
      </div>
    );
  }

  const { data: items } = await supabase
    .from("store_menu_items")
    .select("*")
    .eq("store_id", store.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>料金・メニュー</h1>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
        参加費・レイト・ドリンクなど、店舗独自の料金表です。公開中の項目は店舗詳細ページに表示されます。
      </p>

      <div className="card">
        <form action={createMenuItem}>
          <input type="hidden" name="storeId" value={store.id} />
          <div className="field">
            <span className="muted">項目名 *</span>
            <input type="text" name="name" required placeholder="例: 参加費" />
          </div>
          <div className="field">
            <span className="muted">料金 *</span>
            <input type="text" name="price" required placeholder="例: ¥3,000〜 / ¥1,000（30分）" />
          </div>
          <div className="field">
            <span className="muted">補足（任意）</span>
            <textarea name="description" rows={2} placeholder="例: ドリンク1杯付き" />
          </div>
          <button type="submit" className="btn primary">
            追加する
          </button>
        </form>
      </div>

      {items?.map((it) => (
        <div className="card" key={it.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3>{it.name}</h3>
            <span className="badge">{it.status === "published" ? "公開中" : "非公開"}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{it.price}</div>
          {it.description && (
            <p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>
              {it.description}
            </p>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <form
              action={async () => {
                "use server";
                await toggleMenuItemStatus(it.id, store.id, it.status === "published" ? "hidden" : "published");
              }}
            >
              <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                {it.status === "published" ? "非公開にする" : "公開する"}
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await deleteMenuItem(it.id, store.id);
              }}
            >
              <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                削除
              </button>
            </form>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="muted small" style={{ cursor: "pointer" }}>
              編集
            </summary>
            <form action={updateMenuItem} style={{ marginTop: 10 }}>
              <input type="hidden" name="storeId" value={store.id} />
              <input type="hidden" name="itemId" value={it.id} />
              <div className="field">
                <span className="muted">項目名 *</span>
                <input type="text" name="name" required defaultValue={it.name} />
              </div>
              <div className="field">
                <span className="muted">料金 *</span>
                <input type="text" name="price" required defaultValue={it.price} />
              </div>
              <div className="field">
                <span className="muted">補足（任意）</span>
                <textarea name="description" rows={2} defaultValue={it.description ?? ""} />
              </div>
              <button type="submit" className="btn primary" style={{ fontSize: 12.5 }}>
                更新する
              </button>
            </form>
          </details>
        </div>
      ))}
    </div>
  );
}
