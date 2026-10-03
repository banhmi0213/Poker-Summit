import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { createNotice, updateNotice, toggleNoticeStatus, deleteNotice } from "../notices-actions";

// /store/profile 1ページの中の1セクションだったお知らせ管理を、独立した
// ページへ分離(2026/09/30)。
export default async function StoreNoticesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/store/login?next=/store/profile/notices");
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

  const { data: notices } = await supabase
    .from("store_notices")
    .select("*")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>お知らせ管理</h1>

      <div className="card">
        <form action={createNotice} encType="multipart/form-data">
          <input type="hidden" name="storeId" value={store.id} />
          <div className="field">
            <span className="muted">タイトル *</span>
            <input type="text" name="title" required />
          </div>
          <div className="field">
            <span className="muted">本文</span>
            <textarea name="body" rows={3} />
          </div>
          <div className="field">
            <span className="muted">画像（任意）</span>
            <input type="file" name="image" accept="image/*" capture="environment" />
          </div>
          <button type="submit" className="btn primary">
            お知らせを掲載する
          </button>
        </form>
      </div>

      {notices?.map((n) => (
        <div className="card" key={n.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3>{n.title}</h3>
            <span className="badge">{n.status === "published" ? "公開中" : "非公開"}</span>
          </div>
          {n.image_url && (
            <img
              src={n.image_url}
              alt=""
              style={{ width: "100%", maxWidth: 320, borderRadius: 8, marginTop: 8, objectFit: "cover" }}
            />
          )}
          {n.body && (
            <p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>
              {n.body}
            </p>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <form
              action={async () => {
                "use server";
                await toggleNoticeStatus(n.id, store.id, n.status === "published" ? "hidden" : "published");
              }}
            >
              <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                {n.status === "published" ? "非公開にする" : "公開する"}
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await deleteNotice(n.id, store.id);
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
            <form action={updateNotice} encType="multipart/form-data" style={{ marginTop: 10 }}>
              <input type="hidden" name="storeId" value={store.id} />
              <input type="hidden" name="noticeId" value={n.id} />
              <div className="field">
                <span className="muted">タイトル *</span>
                <input type="text" name="title" required defaultValue={n.title} />
              </div>
              <div className="field">
                <span className="muted">本文</span>
                <textarea name="body" rows={3} defaultValue={n.body ?? ""} />
              </div>
              <div className="field">
                <span className="muted">画像を差し替える（任意）</span>
                <input type="file" name="image" accept="image/*" capture="environment" />
              </div>
              {n.image_url && (
                <label className="muted small" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <input type="checkbox" name="removeImage" />
                  現在の画像を削除する
                </label>
              )}
              <button type="submit" className="btn primary" style={{ fontSize: 12.5, marginTop: 10 }}>
                更新する
              </button>
            </form>
          </details>
        </div>
      ))}
    </div>
  );
}
