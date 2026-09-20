import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { updateStoreProfile } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
  listed: "掲載済み",
};

export default async function StoreProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_user_id", user?.id ?? "")
    .maybeSingle();

  return (
    <div>
      <header className="header">
        <div className="brand">Poker Summit 店舗管理</div>
        <form action={signOut}>
          <button type="submit" className="btn">
            ログアウト ({user?.email})
          </button>
        </form>
      </header>
      <div className="container">
        {!store ? (
          <p className="err">
            このアカウントに紐づく店舗が見つかりません。運営に店舗オーナーとしての登録を依頼してください。
          </p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <h1 style={{ fontSize: 20 }}>{store.name}</h1>
              <span className="badge">
                {STATUS_LABEL[store.status] ?? store.status}
              </span>
            </div>
            <div className="card">
              <form action={updateStoreProfile}>
                <input type="hidden" name="storeId" value={store.id} />
                <div className="field">
                  <span className="muted">住所</span>
                  <input
                    type="text"
                    name="address"
                    defaultValue={store.address ?? ""}
                  />
                </div>
                <div className="field">
                  <span className="muted">電話番号</span>
                  <input type="text" name="tel" defaultValue={store.tel ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">営業時間</span>
                  <input
                    type="text"
                    name="hours"
                    defaultValue={store.hours ?? ""}
                  />
                </div>
                <div className="field">
                  <span className="muted">店舗紹介文</span>
                  <textarea
                    name="description"
                    rows={5}
                    defaultValue={store.description ?? ""}
                  />
                </div>
                <button type="submit" className="btn primary">
                  保存する
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
