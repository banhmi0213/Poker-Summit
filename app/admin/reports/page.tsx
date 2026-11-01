import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { setReportStatus, deleteReport, saveReportMemo, moderateReportTarget, replyToReporter, contactReportedStore } from "./actions";
import { ReplyTemplates } from "./reply-templates";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  open: "未対応",
  investigating: "確認中",
  resolved: "対応済み",
  dismissed: "問題なし(却下)",
};

const TARGET_TYPE_LABEL: Record<string, string> = {
  post: "掲示板の投稿",
  reply: "掲示板の返信",
  store: "店舗",
  job: "求人",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function snippet(text: string | null | undefined, n = 160) {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

// 通報管理(2026/10 作り直し)。何が・誰から・どんな理由で通報されたかを1件ごとに表示し、
// 対象を開く・非表示にする等の対応をこの画面から直接できるようにした。
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: { status?: string; from?: string; to?: string; error?: string; sent?: string };
}) {
  const supabase = await createClient();
  const status = searchParams.status ?? "open";
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";

  let query = supabase.from("reports").select("*").order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  const { data: reports } = await query;

  const ids = (t: string) => (reports ?? []).filter((r) => r.target_type === t).map((r) => r.target_id);
  const postIds = ids("post");
  const replyIds = ids("reply");
  const storeIds = ids("store");
  const jobIds = ids("job");
  const targetIds = Array.from(new Set((reports ?? []).map((r) => r.target_id)));

  const [{ data: posts }, { data: replies }, { data: stores }, { data: jobs }, { data: sameTarget }] = await Promise.all([
    postIds.length
      ? supabase.from("board_posts").select("id, title, body, author_name, status").in("id", postIds)
      : Promise.resolve({ data: [] as any[] }),
    replyIds.length
      ? supabase.from("board_replies").select("id, body, post_id, author_name, status").in("id", replyIds)
      : Promise.resolve({ data: [] as any[] }),
    storeIds.length
      ? supabase.from("stores").select("id, name, pref, city, status, owner_user_id").in("id", storeIds)
      : Promise.resolve({ data: [] as any[] }),
    jobIds.length
      ? supabase.from("jobs").select("id, title, store_id, status, stores(name, owner_user_id)").in("id", jobIds)
      : Promise.resolve({ data: [] as any[] }),
    targetIds.length
      ? supabase.from("reports").select("target_id").in("target_id", targetIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const postMap = new Map((posts ?? []).map((p: any) => [p.id, p]));
  const replyMap = new Map((replies ?? []).map((r: any) => [r.id, r]));
  const storeMap = new Map((stores ?? []).map((s: any) => [s.id, s]));
  const jobMap = new Map((jobs ?? []).map((j: any) => [j.id, j]));
  const countByTarget = new Map<string, number>();
  for (const r of sameTarget ?? []) countByTarget.set(r.target_id, (countByTarget.get(r.target_id) ?? 0) + 1);

  // 通報した人・店舗への連絡の履歴
  const reportIds = (reports ?? []).map((r) => r.id);
  const { data: contactRows } = reportIds.length
    ? await supabase.from("report_replies").select("report_id, kind, body, sent_to, sent_by_email, sent_at").in("report_id", reportIds).order("sent_at")
    : { data: [] as any[] };
  const contactsBy = new Map<string, any[]>();
  for (const c of contactRows ?? []) contactsBy.set(c.report_id, [...(contactsBy.get(c.report_id) ?? []), c]);

  // 通報した人(会員)の名前とメール。未ログインでの通報は「未ログインの利用者」と表示
  const reporterIds = Array.from(new Set((reports ?? []).map((r) => r.reporter_user_id).filter(Boolean))) as string[];
  const reporterMap = new Map<string, { name: string | null; email: string | null }>();
  if (reporterIds.length) {
    const svc = createServiceRoleClient();
    await Promise.all(
      reporterIds.map(async (id) => {
        const { data } = await svc.auth.admin.getUserById(id);
        reporterMap.set(id, {
          name: (data.user?.user_metadata?.display_name as string | undefined) ?? null,
          email: data.user?.email ?? null,
        });
      })
    );
  }

  function targetInfo(r: { target_type: string; target_id: string }) {
    if (r.target_type === "post") {
      const p: any = postMap.get(r.target_id);
      return p
        ? { title: p.title, body: snippet(p.body), by: p.author_name, href: `/board/${p.id}`, hidden: p.status === "hidden", exists: true }
        : { title: "(削除済みの投稿)", exists: false };
    }
    if (r.target_type === "reply") {
      const rep: any = replyMap.get(r.target_id);
      return rep
        ? { title: "返信", body: snippet(rep.body), by: rep.author_name, href: `/board/${rep.post_id}`, hidden: rep.status === "hidden", exists: true }
        : { title: "(削除済みの返信)", exists: false };
    }
    if (r.target_type === "store") {
      const s: any = storeMap.get(r.target_id);
      return s
        ? { title: s.name, body: [s.pref, s.city].filter(Boolean).join(" "), href: `/stores/${s.id}`, editHref: `/admin/stores/${s.id}/edit`, exists: true, storeName: s.name, storeContactable: !!s.owner_user_id }
        : { title: "(削除済みの店舗)", exists: false };
    }
    if (r.target_type === "job") {
      const j: any = jobMap.get(r.target_id);
      return j
        ? { title: j.title, body: j.stores?.name ? `店舗：${j.stores.name}` : "", href: `/jobs/${j.id}`, hidden: j.status === "closed", exists: true, storeName: j.stores?.name, storeContactable: !!j.stores?.owner_user_id }
        : { title: "(削除済みの求人)", exists: false };
    }
    return { title: r.target_id, exists: false };
  }

  const filters: { key: string; label: string }[] = [
    { key: "open", label: "未対応" },
    { key: "investigating", label: "確認中" },
    { key: "resolved", label: "対応済み" },
    { key: "dismissed", label: "問題なし(却下)" },
    { key: "all", label: "すべて" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>通報管理</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        利用者からの通報です。内容を確かめて、問題があれば「非表示にする」「店舗情報を直す」などで対応し、最後に「対応済み」にしてください。
        問題がなければ「問題なし(却下)」にします。
      </p>

      {searchParams.error && <p className="err" style={{ marginBottom: 12 }}>{searchParams.error}</p>}
      {searchParams.sent && <p style={{ marginBottom: 12, color: "#1f7a3a", fontWeight: 700 }}>{searchParams.sent}</p>}

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/admin/reports?status=${f.key}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
            className={`btn ${status === f.key ? "primary" : ""}`}
            style={{ fontSize: 12.5 }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <form method="get" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <input type="hidden" name="status" value={status} />
        <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
          <span className="muted">日時 from</span>
          <input type="date" name="from" defaultValue={from} style={{ maxWidth: 160 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
          <span className="muted">日時 to</span>
          <input type="date" name="to" defaultValue={to} style={{ maxWidth: 160 }} />
        </label>
        <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
          絞り込む
        </button>
      </form>

      {(!reports || reports.length === 0) && <p className="muted">該当する通報はありません。</p>}

      {reports?.map((r) => {
        const info: any = targetInfo(r);
        const reporter = r.reporter_user_id ? reporterMap.get(r.reporter_user_id) : null;
        const total = countByTarget.get(r.target_id) ?? 1;
        return (
          <div className="card" key={r.id} id={`rep-${r.id}`} style={{ display: "grid", gap: 10, scrollMarginTop: 80 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span className="badge">{TARGET_TYPE_LABEL[r.target_type] ?? r.target_type}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{formatDate(r.created_at)}</span>
                {total > 1 && (
                  <span style={{ background: "#aa3b28", color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
                    同じ対象への通報 {total}件
                  </span>
                )}
              </div>
              <span className="badge">{STATUS_LABEL[r.status] ?? r.status}</span>
            </div>

            {/* 通報された対象 */}
            <div style={{ background: "#faf6ec", borderRadius: 8, padding: "10px 12px" }}>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 2 }}>通報された{TARGET_TYPE_LABEL[r.target_type] ?? "対象"}</div>
              <div style={{ fontWeight: 700 }}>
                {info.title}
                {info.hidden && <span className="badge" style={{ marginLeft: 8 }}>非表示中</span>}
              </div>
              {info.body && <div style={{ fontSize: 13.5, marginTop: 4, whiteSpace: "pre-wrap" }}>{info.body}</div>}
              {info.by && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>投稿者：{info.by}</div>}
              {info.href && (
                <div style={{ marginTop: 6 }}>
                  <a href={info.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
                    サイトで開いて確かめる
                  </a>
                </div>
              )}
            </div>

            {/* 通報の内容 */}
            <div>
              <div style={{ fontSize: 13.5 }}>
                <strong>理由：</strong>
                {r.reason || "（理由の選択なし）"}
              </div>
              <div style={{ fontSize: 13.5, marginTop: 2, whiteSpace: "pre-wrap" }}>
                <strong>詳しい内容：</strong>
                {r.detail || <span className="muted">（記入なし。以前の通報ボタンからの通報は理由が記録されていません）</span>}
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                通報した人：
                {reporter ? `${reporter.name ?? "(ハンドルネーム未設定)"}・${reporter.email ?? ""}` : "未ログインの利用者"}
                {r.reporter_email && `（返信先：${r.reporter_email}）`}
                {r.reporter_user_id && (
                  <>
                    {" "}
                    <Link href={`/admin/members/${r.reporter_user_id}`}>会員情報 ›</Link>
                  </>
                )}
              </div>
            </div>

            {/* 対応 */}
            {info.exists && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(r.target_type === "post" || r.target_type === "reply" || r.target_type === "job") && (
                  <form action={moderateReportTarget.bind(null, r.id, info.hidden ? "show" : "hide")}>
                    <button type="submit" className="btn" style={{ fontSize: 12.5, borderColor: info.hidden ? undefined : "#aa3b28", color: info.hidden ? undefined : "#aa3b28" }}>
                      {info.hidden
                        ? r.target_type === "job" ? "求人を公開に戻す" : "表示に戻す"
                        : r.target_type === "job" ? "求人を非公開にする" : "この投稿を非表示にする"}
                    </button>
                  </form>
                )}
                {r.target_type === "store" && info.editHref && (
                  <Link href={info.editHref} className="btn" style={{ fontSize: 12.5 }}>
                    店舗情報を直す
                  </Link>
                )}
              </div>
            )}

            {/* 連絡(通報した人・通報された店舗) */}
            {(() => {
              const history = contactsBy.get(r.id) ?? [];
              const reporterReachable = !!(r.reporter_email || reporter?.email);
              return (
                <div style={{ display: "grid", gap: 10 }}>
                  {history.length > 0 && (
                    <div style={{ display: "grid", gap: 6 }}>
                      <strong style={{ fontSize: 13 }}>連絡の履歴</strong>
                      {history.map((h: any, idx: number) => (
                        <div key={idx} style={{ borderLeft: `3px solid ${h.kind === "store" ? "#4b7bc9" : "#c9a24b"}`, padding: "4px 10px", fontSize: 13.5 }}>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {formatDate(h.sent_at)}・{h.kind === "store" ? "店舗へ" : "通報した人へ"}（{h.sent_to}）・{h.sent_by_email ?? "運営"}
                          </div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{h.body}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700 }}>通報した人に返信する</summary>
                    {reporterReachable ? (
                      <form action={replyToReporter.bind(null, r.id)} style={{ display: "grid", gap: 6, marginTop: 8 }}>
                        <input type="hidden" name="status" value={status} />
                        <ReplyTemplates
                          targetId={`reply-${r.id}`}
                          templates={[
                            { label: "対応しました", text: "ご指摘いただいた内容を確認し、対応いたしました。" },
                            { label: "問題なし", text: "ご指摘いただいた内容を確認しましたが、現時点で問題は見つかりませんでした。" },
                            { label: "確認中", text: "ご指摘いただいた内容を、現在確認しております。対応が済みましたら改めてご連絡いたします。" },
                          ]}
                        />
                        <textarea id={`reply-${r.id}`} name="body" rows={3} required maxLength={5000} placeholder="通報した方へのメール本文（あいさつ・署名は自動で付きます。通報された側の事情は書かないでください）" style={{ fontSize: 14 }} />
                        <div>
                          <button type="submit" className="btn primary" style={{ fontSize: 12.5 }}>メールで返信する</button>
                        </div>
                      </form>
                    ) : (
                      <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>この通報には連絡先がありません（未ログインで、メールアドレスの記入もありませんでした）。</p>
                    )}
                  </details>
                  {(r.target_type === "store" || r.target_type === "job") && info.exists && (
                    <details>
                      <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700 }}>
                        通報された店舗に連絡する{info.storeName ? `（${info.storeName}）` : ""}
                      </summary>
                      {info.storeContactable ? (
                        <form action={contactReportedStore.bind(null, r.id)} style={{ display: "grid", gap: 6, marginTop: 8 }}>
                          <input type="hidden" name="status" value={status} />
                          <input name="title" defaultValue={r.target_type === "job" ? "求人内容のご確認のお願い" : "店舗情報のご確認のお願い"} maxLength={100} style={{ fontSize: 14 }} />
                          <ReplyTemplates
                            targetId={`store-${r.id}`}
                            templates={[
                              {
                                label: "確認のお願い",
                                text:
                                  r.target_type === "job"
                                    ? `掲載中の求人について、${r.reason && r.reason !== "ユーザーからの通報" ? `利用者の方から「${r.reason}」とのご指摘がありました。` : "利用者の方からご指摘がありました。"}お手数ですが、店舗管理画面の「求人」から内容をご確認いただき、必要に応じて修正をお願いいたします。`
                                    : `掲載中の店舗情報について、${r.reason && r.reason !== "ユーザーからの通報" ? `利用者の方から「${r.reason}」とのご指摘がありました。` : "利用者の方からご指摘がありました。"}お手数ですが、店舗管理画面の「店舗情報」から内容をご確認いただき、必要に応じて修正をお願いいたします。`,
                              },
                            ]}
                          />
                          <textarea id={`store-${r.id}`} name="body" rows={4} required maxLength={5000} placeholder="店舗へのお知らせ本文（店舗管理画面の「運営からのお知らせ」とメールに届きます。通報した人の情報は書かないでください）" style={{ fontSize: 14 }} />
                          <div>
                            <button type="submit" className="btn primary" style={{ fontSize: 12.5 }}>店舗に送る</button>
                          </div>
                        </form>
                      ) : (
                        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>契約店舗ではないため、店舗管理画面がありません。「店舗情報を直す」から運営で直してください。</p>
                      )}
                    </details>
                  )}
                </div>
              );
            })()}

            {/* 運営メモ */}
            <form action={saveReportMemo.bind(null, r.id)} style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
              <textarea
                name="memo"
                defaultValue={r.admin_memo ?? ""}
                rows={2}
                placeholder="運営メモ（何を確認したか・どう対応したか。利用者には見えません）"
                style={{ flex: "1 1 320px", fontSize: 13 }}
                data-no-draft
              />
              <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                メモを保存
              </button>
            </form>

            {/* 状態 */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid #eee", paddingTop: 10 }}>
              {r.status !== "investigating" && (
                <form action={setReportStatus.bind(null, r.id, "investigating")}>
                  <button type="submit" className="btn" style={{ fontSize: 12.5 }}>確認中にする</button>
                </form>
              )}
              {r.status !== "resolved" && (
                <form action={setReportStatus.bind(null, r.id, "resolved")}>
                  <button type="submit" className="btn primary" style={{ fontSize: 12.5 }}>対応済みにする</button>
                </form>
              )}
              {r.status !== "dismissed" && (
                <form action={setReportStatus.bind(null, r.id, "dismissed")}>
                  <button type="submit" className="btn" style={{ fontSize: 12.5 }}>問題なし(却下)</button>
                </form>
              )}
              {r.status !== "open" && (
                <form action={setReportStatus.bind(null, r.id, "open")}>
                  <button type="submit" className="btn" style={{ fontSize: 12.5 }}>未対応に戻す</button>
                </form>
              )}
              <form action={deleteReport.bind(null, r.id)} style={{ marginLeft: "auto" }}>
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>通報を削除</button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}
