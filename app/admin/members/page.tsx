import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteMember } from "./actions";

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString("ja-JP");
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: { q?: string; dup?: string };
}) {
  const q = searchParams.q?.trim().toLowerCase() ?? "";

  const supabase = await createClient();
  const { data: members, error } = await supabase.rpc("admin_list_members");

  let list = members ?? [];
  if (q) {
    list = list.filter(
      (m: any) =>
        m.email?.toLowerCase().includes(q) || m.store_name?.toLowerCase().includes(q)
    );
  }

  // 登録時のIPアドレス(重複登録の見回り用)。同じIPから7日以内に登録された会員の数を出す。
  const { data: signupLogs } = await supabase
    .from("member_signup_logs")
    .select("user_id, ip, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  const logByUser = new Map<string, { ip: string | null; created_at: string }>();
  const byIp = new Map<string, { user_id: string; t: number }[]>();
  for (const l of (signupLogs ?? []) as { user_id: string; ip: string | null; created_at: string }[]) {
    logByUser.set(l.user_id, l);
    if (!l.ip) continue;
    const arr = byIp.get(l.ip) ?? [];
    arr.push({ user_id: l.user_id, t: Date.parse(l.created_at) });
    byIp.set(l.ip, arr);
  }
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const sameIpCount = (userId: string) => {
    const log = logByUser.get(userId);
    if (!log?.ip) return 0;
    const t = Date.parse(log.created_at);
    return (byIp.get(log.ip) ?? []).filter((x) => x.user_id !== userId && Math.abs(x.t - t) <= WEEK).length;
  };
  const dupOnly = searchParams.dup === "1";
  if (dupOnly) list = list.filter((m: any) => sameIpCount(m.id) > 0);
  const dupTotal = (members ?? []).filter((m: any) => sameIpCount(m.id) > 0).length;

  const userIds = list.map((m: any) => m.id);
  const [{ data: favStores }, { data: appliedJobs }] = await Promise.all([
    userIds.length > 0
      ? supabase.from("favorite_stores").select("user_id").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    userIds.length > 0
      ? supabase.from("job_applications").select("user_id").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);
  const favCounts = new Map<string, number>();
  (favStores ?? []).forEach((f) => favCounts.set(f.user_id, (favCounts.get(f.user_id) ?? 0) + 1));
  const appliedCounts = new Map<string, number>();
  (appliedJobs ?? []).forEach((a) =>
    appliedCounts.set(a.user_id, (appliedCounts.get(a.user_id) ?? 0) + 1)
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>会員管理</h1>

      {error && <p className="err">{error.message}</p>}

      <form method="get" style={{ marginBottom: 16 }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="メールアドレス・店舗名で検索"
          style={{ maxWidth: 280 }}
        />
        <button type="submit" className="btn" style={{ marginLeft: 8 }}>
          検索
        </button>
        <Link
          href={dupOnly ? "/admin/members" : "/admin/members?dup=1"}
          className={`btn${dupOnly ? " primary" : ""}`}
          style={{ marginLeft: 8 }}
        >
          同じIPからの登録のみ（{dupTotal}）
        </Link>
      </form>
      <p className="muted" style={{ fontSize: 12, margin: "-6px 0 12px" }}>
        「同一IP」は、同じIPアドレスから7日以内に別の会員登録があった会員です。スマホ回線や店舗Wi-Fiなどでは別人でも同じIPになることがあるため、自動では止めていません。
      </p>

      <div className="table-wrap"><table>
        <thead>
          <tr>
            <th>メールアドレス</th>
            <th>登録日</th>
            <th>種別</th>
            <th>紐づく店舗</th>
            <th>お気に入り店舗</th>
            <th>応募求人</th>
            <th>状態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={8} className="muted">
                該当する会員がいません。
              </td>
            </tr>
          )}
          {list.map((m: any) => (
            <tr key={m.id}>
              <td>{m.email}</td>
              <td>
                {formatDate(m.created_at)}
                {sameIpCount(m.id) > 0 && (
                  <span
                    className="badge"
                    title={`登録IP: ${logByUser.get(m.id)?.ip ?? ""}`}
                    style={{ marginLeft: 6, background: "rgba(230, 160, 40, 0.18)", color: "#9a6200" }}
                  >
                    同一IP {sameIpCount(m.id) + 1}件
                  </span>
                )}
                {logByUser.get(m.id)?.ip && (
                  <div className="muted" style={{ fontSize: 11 }}>IP: {logByUser.get(m.id)?.ip}</div>
                )}
              </td>
              <td>
                {m.is_admin && <span className="badge">運営</span>}
                {m.store_id && !m.is_admin && (
                  <span className="badge">店舗オーナー</span>
                )}
                {!m.is_admin && !m.store_id && (
                  <span className="muted">一般</span>
                )}
              </td>
              <td>{m.store_name ?? ""}</td>
              <td className="tabular">{favCounts.get(m.id) ?? 0}</td>
              <td className="tabular">{appliedCounts.get(m.id) ?? 0}</td>
              <td>
                {m.suspended ? (
                  <span
                    className="badge"
                    style={{ background: "rgba(230, 80, 80, 0.14)", color: "var(--critical)" }}
                  >
                    利用停止中
                  </span>
                ) : (
                  <span className="muted">通常</span>
                )}
              </td>
              <td>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Link href={`/admin/members/${m.id}`} className="btn" style={{ fontSize: 12 }}>
                    詳細
                  </Link>
                  {!m.is_admin && (
                    <form
                      action={async () => {
                        "use server";
                        await deleteMember(m.id);
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12 }}>
                        削除
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
