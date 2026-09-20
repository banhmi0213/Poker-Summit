import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { updateStoreProfile } from "./actions";
import { createJob, toggleJobStatus } from "./jobs-actions";
import { createCoupon, deactivateCoupon } from "./coupons-actions";
import { JOB_TYPE_OPTIONS, STORE_STATUS_LABEL } from "@/lib/constants";

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

  const { data: jobs } = store
    ? await supabase
        .from("jobs")
        .select("*")
        .eq("store_id", store.id)
        .order("posted_at", { ascending: false })
    : { data: null };

  const { data: coupons } = store
    ? await supabase
        .from("coupons")
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
    : { data: null };

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
                {STORE_STATUS_LABEL[store.status] ?? store.status}
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

            <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
              求人管理
            </h2>
            <div className="card">
              <form action={createJob}>
                <input type="hidden" name="storeId" value={store.id} />
                <div className="field">
                  <span className="muted">求人タイトル</span>
                  <input type="text" name="title" required />
                </div>
                <div className="field">
                  <span className="muted">雇用形態</span>
                  <select name="jobType" defaultValue="">
                    <option value="">選択してください</option>
                    {JOB_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="muted">給与</span>
                  <input type="text" name="salary" placeholder="例: 時給1300円〜" />
                </div>
                <div className="field">
                  <span className="muted">仕事内容</span>
                  <textarea name="description" rows={3} />
                </div>
                <button type="submit" className="btn primary">
                  求人を掲載する
                </button>
              </form>
            </div>

            {jobs?.map((j) => (
              <div className="card" key={j.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <h3>{j.title}</h3>
                  <span className="badge">
                    {j.status === "open" ? "募集中" : "終了"}
                  </span>
                </div>
                {j.salary && <p className="muted">{j.salary}</p>}
                <form
                  action={async () => {
                    "use server";
                    await toggleJobStatus(
                      j.id,
                      store.id,
                      j.status === "open" ? "closed" : "open"
                    );
                  }}
                  style={{ marginTop: 8 }}
                >
                  <button type="submit" className="btn">
                    {j.status === "open" ? "募集を終了する" : "募集を再開する"}
                  </button>
                </form>
              </div>
            ))}

            <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
              クーポン管理
            </h2>
            <div className="card">
              <form action={createCoupon}>
                <input type="hidden" name="storeId" value={store.id} />
                <div className="field">
                  <span className="muted">クーポンタイトル</span>
                  <input type="text" name="title" required />
                </div>
                <div className="field">
                  <span className="muted">割引内容</span>
                  <input type="text" name="discount" placeholder="例: 500円引き" />
                </div>
                <div className="field">
                  <span className="muted">説明</span>
                  <textarea name="description" rows={3} />
                </div>
                <div className="field">
                  <span className="muted">クーポンコード</span>
                  <input type="text" name="code" />
                </div>
                <div className="field">
                  <span className="muted">有効期限</span>
                  <input type="date" name="validUntil" />
                </div>
                <button type="submit" className="btn primary">
                  クーポンを発行する
                </button>
              </form>
            </div>

            {coupons?.map((c) => (
              <div className="card" key={c.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <h3>{c.title}</h3>
                  <span className="badge">{c.active ? "公開中" : "停止中"}</span>
                </div>
                {c.discount && <p className="muted">{c.discount}</p>}
                {c.active && (
                  <form
                    action={async () => {
                      "use server";
                      await deactivateCoupon(c.id, store.id);
                    }}
                    style={{ marginTop: 8 }}
                  >
                    <button type="submit" className="btn">
                      公開を停止する
                    </button>
                  </form>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
