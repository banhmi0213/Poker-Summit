import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  setStoreStatus,
  setStoreOwnerByEmail,
  createStoreByAdmin,
  updateStoreByAdmin,
  deleteStoreByAdmin,
  issueStoreLogin,
  reissueStorePassword,
} from "./actions";
import {
  STORE_STATUS_LABEL as STATUS_LABEL,
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  REGIONS,
  PREF_OPTIONS,
} from "@/lib/constants";

export default async function AdminStoresPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "all";

  let query = supabase
    .from("stores")
    .select(
      "id, name, category, region, pref, city, address, tel, hours, description, area_keywords, status, owner_user_id, created_at"
    )
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data: stores } = await query;

  const { data: logins } = await supabase.rpc("admin_list_store_logins");
  const loginMap = new Map<string, string>((logins ?? []).map((l: any) => [l.store_id, l.login_id]));

  const jar = await cookies();
  const issuedRaw = jar.get("issued_credentials")?.value;
  let issued: { storeId: string; loginId: string; password: string } | null = null;
  if (issuedRaw) {
    try {
      issued = JSON.parse(issuedRaw);
    } catch {
      issued = null;
    }
    jar.delete("issued_credentials");
  }
  const issuedStoreName = issued ? stores?.find((s) => s.id === issued!.storeId)?.name : null;

  return (
    <div>
      {issued && (
        <div className="card" style={{ borderColor: "var(--good)", marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>
            {issuedStoreName ?? "店舗"} のログイン情報（この画面を閉じると二度と表示されません）
          </h3>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="muted" style={{ fontSize: 12 }}>ログインID</span>
              <input readOnly value={`${issued.loginId}@login.poker-summit.jp`} style={{ minWidth: 260 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="muted" style={{ fontSize: 12 }}>パスワード</span>
              <input readOnly value={issued.password} style={{ minWidth: 160 }} />
            </label>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            この内容を店舗にお伝えください。ログインページではメールアドレス欄にログインIDをそのまま入力してもらいます。
          </p>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <h1 style={{ fontSize: 22 }}>店舗管理</h1>
      </div>

      <details className="card" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>＋ 店舗を追加</summary>
        <form
          action={createStoreByAdmin}
          style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}
        >
          <div className="field">
            <span className="muted">店舗名 *</span>
            <input type="text" name="name" required />
          </div>
          <div className="field">
            <span className="muted">カテゴリ</span>
            <select name="category" defaultValue="">
              <option value="">未設定</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">地方</span>
            <select name="region" defaultValue="">
              <option value="">未設定</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">都道府県</span>
            <select name="pref" defaultValue="">
              <option value="">未設定</option>
              {PREF_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">市区町村</span>
            <input type="text" name="city" />
          </div>
          <div className="field">
            <span className="muted">住所</span>
            <input type="text" name="address" />
          </div>
          <div className="field">
            <span className="muted">電話番号</span>
            <input type="text" name="tel" />
          </div>
          <div className="field">
            <span className="muted">営業時間</span>
            <input type="text" name="hours" />
          </div>
          <div className="field">
            <span className="muted">紹介文</span>
            <textarea name="description" rows={3} />
          </div>
          <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
            追加する（即時掲載）
          </button>
        </form>
      </details>

      <form
        method="get"
        style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="店舗名で検索"
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
            width: 220,
          }}
        />
        <select
          name="status"
          defaultValue={status}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
          }}
        >
          <option value="all">ステータス: すべて</option>
          <option value="approved">承認済み</option>
          <option value="pending">承認待ち</option>
          <option value="rejected">却下</option>
        </select>
        <button type="submit" className="btn">
          検索
        </button>
      </form>

      <table>
        <thead>
          <tr>
            <th>店舗名</th>
            <th>カテゴリ</th>
            <th>エリア</th>
            <th>ステータス</th>
            <th>オーナー</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {(!stores || stores.length === 0) && (
            <tr>
              <td colSpan={6} className="muted">
                該当する店舗がありません。
              </td>
            </tr>
          )}
          {stores?.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>
                <span className="badge outline">
                  {CATEGORY_LABEL[s.category ?? ""] ?? s.category ?? ""}
                </span>
              </td>
              <td>{[s.region, s.pref].filter(Boolean).join(" / ")}</td>
              <td>
                <span className="badge">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </td>
              <td>
                {loginMap.has(s.id) ? (
                  <div style={{ marginBottom: 6 }}>
                    <div className="cred-box" style={{ fontSize: 12, marginBottom: 4 }}>
                      ID: {loginMap.get(s.id)}
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await reissueStorePassword(s.id);
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12, padding: "5px 8px" }}>
                        パスワード再発行
                      </button>
                    </form>
                  </div>
                ) : s.owner_user_id ? (
                  <div style={{ marginBottom: 6 }}>
                    <span className="badge">設定済み(既存アカウント連携)</span>
                  </div>
                ) : (
                  <div style={{ marginBottom: 6 }}>
                    <span className="badge" style={{ marginBottom: 4, display: "inline-block" }}>未設定</span>
                    <form
                      action={async () => {
                        "use server";
                        await issueStoreLogin(s.id);
                      }}
                    >
                      <button type="submit" className="btn primary" style={{ fontSize: 12, padding: "5px 8px" }}>
                        ログイン情報を発行
                      </button>
                    </form>
                  </div>
                )}
                <details>
                  <summary className="muted" style={{ cursor: "pointer", fontSize: 11.5 }}>
                    既存アカウントのメールで設定
                  </summary>
                  <form
                    action={setStoreOwnerByEmail}
                    style={{ display: "flex", gap: 6, marginTop: 6 }}
                  >
                    <input type="hidden" name="storeId" value={s.id} />
                    <input
                      type="email"
                      name="email"
                      placeholder="オーナーのメール"
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        fontSize: 12.5,
                        width: 150,
                      }}
                    />
                    <button type="submit" className="btn" style={{ padding: "6px 10px", fontSize: 12.5 }}>
                      設定
                    </button>
                  </form>
                </details>
              </td>
              <td>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {s.status === "pending" && (
                    <>
                      <form
                        action={async () => {
                          "use server";
                          await setStoreStatus(s.id, "approved");
                        }}
                      >
                        <button type="submit" className="btn primary" style={{ fontSize: 12 }}>
                          承認
                        </button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await setStoreStatus(s.id, "rejected");
                        }}
                      >
                        <button type="submit" className="btn" style={{ fontSize: 12 }}>
                          却下
                        </button>
                      </form>
                    </>
                  )}
                  {s.status === "rejected" && (
                    <form
                      action={async () => {
                        "use server";
                        await setStoreStatus(s.id, "pending");
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12 }}>
                        承認待ちに戻す
                      </button>
                    </form>
                  )}
                  <form
                    action={async () => {
                      "use server";
                      await deleteStoreByAdmin(s.id);
                    }}
                  >
                    <button type="submit" className="btn" style={{ fontSize: 12 }}>
                      削除
                    </button>
                  </form>
                </div>
                <details>
                  <summary style={{ cursor: "pointer", fontSize: 12.5 }}>編集</summary>
                  <form
                    action={updateStoreByAdmin}
                    style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, minWidth: 220 }}
                  >
                    <input type="hidden" name="storeId" value={s.id} />
                    <div className="field">
                      <span className="muted">店舗名 *</span>
                      <input type="text" name="name" defaultValue={s.name} required />
                    </div>
                    <div className="field">
                      <span className="muted">カテゴリ</span>
                      <select name="category" defaultValue={s.category ?? ""}>
                        <option value="">未設定</option>
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <span className="muted">地方</span>
                      <select name="region" defaultValue={s.region ?? ""}>
                        <option value="">未設定</option>
                        {REGIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <span className="muted">都道府県</span>
                      <select name="pref" defaultValue={s.pref ?? ""}>
                        <option value="">未設定</option>
                        {PREF_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <span className="muted">市区町村</span>
                      <input type="text" name="city" defaultValue={s.city ?? ""} />
                    </div>
                    <div className="field">
                      <span className="muted">住所</span>
                      <input type="text" name="address" defaultValue={s.address ?? ""} />
                    </div>
                    <div className="field">
                      <span className="muted">電話番号</span>
                      <input type="text" name="tel" defaultValue={s.tel ?? ""} />
                    </div>
                    <div className="field">
                      <span className="muted">営業時間</span>
                      <input type="text" name="hours" defaultValue={s.hours ?? ""} />
                    </div>
                    <div className="field">
                      <span className="muted">エリアキーワード（検索用・任意）</span>
                      <input
                        type="text"
                        name="areaKeywords"
                        placeholder="例: ミナミ アメ村 心斎橋"
                        defaultValue={s.area_keywords ?? ""}
                      />
                    </div>
                    <div className="field">
                      <span className="muted">紹介文</span>
                      <textarea name="description" rows={3} defaultValue={s.description ?? ""} />
                    </div>
                    <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
                      保存する
                    </button>
                  </form>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
