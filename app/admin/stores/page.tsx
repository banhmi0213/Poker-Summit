import Link from "next/link";
import { cookies } from "next/headers";
import { HoursInput } from "@/app/hours-input";
import { createClient } from "@/lib/supabase/server";
import {
  setStoreStatus,
  setStoreRecommended,
  setStoreOwnerByEmail,
  createStoreByAdmin,
  deleteStoreByAdmin,
  issueStoreLogin,
  reissueStorePassword,
  issueStoreLineLinkCode,
  approveStoreChangeRequestByAdmin,
  rejectStoreChangeRequestByAdmin,
} from "./actions";
import {
  STORE_STATUS_LABEL as STATUS_LABEL,
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  REGIONS,
  PREF_OPTIONS,
  PREF_REGION,
} from "@/lib/constants";

export default async function AdminStoresPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; region?: string; pref?: string; area?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "all";
  const region = REGIONS.includes(searchParams.region ?? "") ? searchParams.region! : "";
  const pref = PREF_OPTIONS.includes(searchParams.pref ?? "") ? searchParams.pref! : "";
  const area = searchParams.area?.trim() ?? "";

  let query = supabase
    .from("stores")
    .select(
      "id, name, category, region, pref, city, address, tel, hours, description, area_keywords, status, is_recommended, owner_user_id, line_user_id, created_at"
    )
    // Secondary sort by id: created_at alone ties for rows inserted in the
    // same batch (dummy seed data today, bulk Places-API imports later), and
    // Postgres doesn't guarantee a stable order for ties — without this the
    // row order can visibly shuffle between page loads.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  if (region) {
    query = query.in("pref", PREF_OPTIONS.filter((p) => PREF_REGION[p]?.includes(region)));
  }
  if (pref) query = query.eq("pref", pref);
  if (area) {
    const escaped = area.replace(/\\/g, "\\\\").replace(/[%_]/g, (m) => `\\${m}`).replace(/"/g, '\\"');
    const pattern = `"%${escaped}%"`;
    query = query.or(`city.ilike.${pattern},address.ilike.${pattern},area_keywords.ilike.${pattern}`);
  }

  const { data: stores } = await query;

  const { data: logins } = await supabase.rpc("admin_list_store_logins");
  const loginMap = new Map<string, string>((logins ?? []).map((l: any) => [l.store_id, l.login_id]));

  const { data: pendingChangeRequests } = await supabase
    .from("store_change_requests")
    .select("id, store_id, field, current_value, proposed_value, requested_by, requested_at, stores(name)")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  const jar = await cookies();
  const issuedRaw = jar.get("issued_credentials")?.value;
  let issued: { storeId: string; loginId: string; password: string } | null = null;
  if (issuedRaw) {
    try {
      issued = JSON.parse(issuedRaw);
    } catch {
      issued = null;
    }
  }
  const issuedStoreName = issued ? stores?.find((s) => s.id === issued!.storeId)?.name : null;

  const issuedLinkCodeRaw = jar.get("issued_line_link_code")?.value;
  let issuedLinkCode: { storeId: string; code: string } | null = null;
  if (issuedLinkCodeRaw) {
    try {
      issuedLinkCode = JSON.parse(issuedLinkCodeRaw);
    } catch {
      issuedLinkCode = null;
    }
  }
  const issuedLinkCodeStoreName = issuedLinkCode
    ? stores?.find((s) => s.id === issuedLinkCode!.storeId)?.name
    : null;

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
              <input readOnly value={issued.loginId} style={{ minWidth: 260 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="muted" style={{ fontSize: 12 }}>パスワード</span>
              <input readOnly value={issued.password} style={{ minWidth: 160 }} />
            </label>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            この内容を店舗にお伝えください。店舗管理ログイン（/store/login）のログインID欄にそのまま入力してもらいます。
          </p>
        </div>
      )}

      {issuedLinkCode && (
        <div className="card" style={{ borderColor: "var(--good)", marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>
            {issuedLinkCodeStoreName ?? "店舗"} のLINE連携コード（この画面を閉じると二度と表示されません）
          </h3>
          <input
            readOnly
            value={issuedLinkCode.code}
            style={{ minWidth: 160, fontSize: 18, fontWeight: 700, letterSpacing: 2 }}
          />
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            このコードを店舗にお伝えください。店舗はLINEミニアプリの初回起動時にこのコードを入力して、自分のLINEアカウントとこの店舗を連携します（24時間有効・1回のみ使用可）。
          </p>
        </div>
      )}

      {pendingChangeRequests && pendingChangeRequests.length > 0 && (
        <div className="card" style={{ borderColor: "var(--accent)", marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>
            店名・住所の変更申請（承認待ち {pendingChangeRequests.length}件）
          </h3>
          {pendingChangeRequests.map((r: any) => (
            <div
              key={r.id}
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 10,
                marginTop: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 700 }}>
                  {r.stores?.name ?? "店舗"} ・ {r.field === "name" ? "店舗名" : "住所"}の変更
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  申請元: {r.requested_by?.startsWith("line:") ? "LINE" : "Web管理画面"} ・{" "}
                  {new Date(r.requested_at).toLocaleString("ja-JP")}
                </div>
                <div style={{ marginTop: 6 }}>
                  {r.field === "name" ? (
                    <>
                      現在: {r.current_value?.name ?? "(未設定)"} → 変更後: <strong>{r.proposed_value?.name}</strong>
                    </>
                  ) : (
                    <>
                      現在: {[r.current_value?.pref, r.current_value?.city, r.current_value?.address].filter(Boolean).join(" ") || "(未設定)"}
                      <br />
                      変更後: <strong>{[r.proposed_value?.pref, r.proposed_value?.city, r.proposed_value?.address].filter(Boolean).join(" ")}</strong>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <form
                  action={async () => {
                    "use server";
                    await approveStoreChangeRequestByAdmin(r.id);
                  }}
                >
                  <button type="submit" className="btn primary" style={{ fontSize: 12 }}>
                    承認して反映
                  </button>
                </form>
                <details>
                  <summary className="btn" style={{ fontSize: 12, cursor: "pointer", display: "inline-block" }}>
                    却下
                  </summary>
                  <form action={rejectStoreChangeRequestByAdmin} style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <input type="hidden" name="requestId" value={r.id} />
                    <input
                      type="text"
                      name="note"
                      placeholder="却下理由（任意）"
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12.5 }}
                    />
                    <button type="submit" className="btn" style={{ fontSize: 12 }}>
                      却下する
                    </button>
                  </form>
                </details>
              </div>
            </div>
          ))}
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
            <HoursInput initialValue="" />
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
        <select name="region" defaultValue={region} aria-label="地方" style={{ padding: "8px 10px", fontSize: 13, width: 150 }}>
          <option value="">地方: すべて</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select name="pref" defaultValue={pref} aria-label="都道府県" style={{ padding: "8px 10px", fontSize: 13, width: 150 }}>
          <option value="">都道府県: すべて</option>
          {PREF_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input name="area" defaultValue={area} aria-label="エリア" placeholder="エリア（市区町村・駅名など）" style={{ padding: "8px 10px", fontSize: 13, width: 220 }} />
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
            <th>PICK UP</th>
            <th>オーナー</th>
            <th>LINE連携</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {(!stores || stores.length === 0) && (
            <tr>
              <td colSpan={8} className="muted">
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
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                  <span className={`badge ${s.is_recommended ? "" : "outline"}`}>
                    {s.is_recommended ? "PICK UP中" : "通常"}
                  </span>
                  <form
                    action={async () => {
                      "use server";
                      await setStoreRecommended(s.id, !s.is_recommended);
                    }}
                  >
                    <button
                      type="submit"
                      className="btn"
                      style={{ fontSize: 12, padding: "5px 8px" }}
                      disabled={!s.is_recommended && s.status !== "approved" && s.status !== "listed"}
                      title={
                        !s.is_recommended && s.status !== "approved" && s.status !== "listed"
                          ? "先に「承認」してからPICK UPにできます"
                          : undefined
                      }
                    >
                      {s.is_recommended ? "PICK UPを解除" : "PICK UPにする"}
                    </button>
                  </form>
                  {/* 承認前のPICK UP押し忘れ事故(2026/10)を防ぐため、未承認
                      店舗はボタン自体を無効化している。理由を一言添える。 */}
                  {!s.is_recommended && s.status !== "approved" && s.status !== "listed" && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      承認後に設定できます
                    </span>
                  )}
                </div>
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
                {/* 以前は<details>で折りたたんでいたが、パスワード再発行ボタンと
                    こちらが同時に見えず片方しか使えないように見えるとの指摘で、
                    常に両方表示する形に変更(2026/09/30)。 */}
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                  既存アカウントのメールで設定
                </div>
                <form
                  action={setStoreOwnerByEmail}
                  style={{ display: "flex", gap: 6, marginTop: 4 }}
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
              </td>
              <td>
                {s.line_user_id ? (
                  <span className="badge">連携済み</span>
                ) : (
                  <div>
                    <span className="badge outline" style={{ marginBottom: 4, display: "inline-block" }}>
                      未連携
                    </span>
                    <form
                      action={async () => {
                        "use server";
                        await issueStoreLineLinkCode(s.id);
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12, padding: "5px 8px" }}>
                        コード発行
                      </button>
                    </form>
                  </div>
                )}
              </td>
              <td>
                <Link
                  href={`/admin/stores/${s.id}/edit`}
                  className="btn primary"
                  style={{ fontSize: 12, marginBottom: 8, display: "inline-block" }}
                >
                  編集
                </Link>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
