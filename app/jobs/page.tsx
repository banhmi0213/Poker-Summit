import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleFavoriteJob } from "@/app/member-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { PREF_OPTIONS, JOB_TYPE_OPTIONS, CATEGORY_LABEL } from "@/lib/constants";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { q?: string; pref?: string; jobType?: string };
}) {
  const q = searchParams.q?.trim() ?? "";
  const pref = searchParams.pref ?? "";
  const jobType = searchParams.jobType ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("jobs")
    .select(
      "id, title, job_type, salary, description, posted_at, banner_image_url, store_id, stores(name, category, pref, status)"
    )
    .eq("status", "open")
    .order("posted_at", { ascending: false });

  if (q) query = query.ilike("title", `%${q}%`);
  if (jobType) query = query.eq("job_type", jobType);

  const { data: rawJobs } = await query;
  let jobs = (rawJobs ?? []).filter((j: any) => j.stores?.status === "approved" || j.stores?.status === "listed");
  if (pref) jobs = jobs.filter((j: any) => j.stores?.pref === pref);

  let favoriteJobIds = new Set<string>();
  if (user) {
    const { data: favs } = await supabase
      .from("favorite_jobs")
      .select("job_id")
      .eq("user_id", user.id);
    favoriteJobIds = new Set((favs ?? []).map((f) => f.job_id));
  }

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container">
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>求人を探す</h1>

        <form
          method="get"
          className="card"
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 20 }}
        >
          <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
            <span className="muted">キーワードで検索</span>
            <input type="text" name="q" defaultValue={q} placeholder="求人タイトル" />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 160px" }}>
            <span className="muted">都道府県</span>
            <select name="pref" defaultValue={pref}>
              <option value="">すべて</option>
              {PREF_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 160px" }}>
            <span className="muted">雇用形態</span>
            <select name="jobType" defaultValue={jobType}>
              <option value="">すべて</option>
              {JOB_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn primary">
            🔍 検索する
          </button>
        </form>

        {jobs.length === 0 && <div className="empty">条件に合う求人が見つかりませんでした。</div>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {jobs.map((j: any) => (
            <div className="card" key={j.id} style={{ padding: 0, overflow: "hidden" }}>
              <form
                action={async () => {
                  "use server";
                  await toggleFavoriteJob(j.id, "/jobs");
                }}
              >
                <button
                  type="submit"
                  className={`job-fav-btn ${favoriteJobIds.has(j.id) ? "active" : ""}`}
                  aria-label="お気に入り"
                >
                  {favoriteJobIds.has(j.id) ? "★" : "☆"}
                </button>
              </form>
              <Link href={`/jobs/${j.id}`} style={{ display: "block" }}>
                {j.banner_image_url ? (
                  <div
                    style={{
                      height: 110,
                      backgroundImage: `url('${j.banner_image_url}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                ) : null}
                <div style={{ padding: "13px 15px" }}>
                  <div className="meta" style={{ marginBottom: 6 }}>
                    {j.stores?.category && (
                      <span className="badge">{CATEGORY_LABEL[j.stores.category] ?? j.stores.category}</span>
                    )}
                    {j.job_type && <span className="badge outline">{j.job_type}</span>}
                  </div>
                  <h3>{j.title}</h3>
                  <div className="muted">
                    {j.stores?.name} ・ {j.stores?.pref}
                  </div>
                  {j.salary && (
                    <div style={{ fontWeight: 700, color: "var(--accent-text)", marginTop: 4 }}>
                      {j.salary}
                    </div>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
      <PortalFooter />
      <BottomTabs active="jobs" />
    </div>
  );
}
