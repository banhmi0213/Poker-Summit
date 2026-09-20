import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleFavoriteJob, applyToJob } from "@/app/member-actions";
import { reportJob } from "@/app/report-actions";
import { PortalHeader } from "@/app/portal-header";

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, job_type, salary, description, posted_at, store_id, stores(name)")
    .eq("status", "open")
    .order("posted_at", { ascending: false });

  let favoriteJobIds = new Set<string>();
  let appliedJobIds = new Set<string>();
  if (user) {
    const [{ data: favs }, { data: apps }] = await Promise.all([
      supabase.from("favorite_jobs").select("job_id").eq("user_id", user.id),
      supabase.from("job_applications").select("job_id").eq("user_id", user.id),
    ]);
    favoriteJobIds = new Set((favs ?? []).map((f) => f.job_id));
    appliedJobIds = new Set((apps ?? []).map((a) => a.job_id));
  }

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container">
        <h1 style={{ fontSize: 24, marginBottom: 20 }}>求人を探す</h1>

        {(!jobs || jobs.length === 0) && (
          <p className="muted">現在募集中の求人はありません。</p>
        )}

        {jobs?.map((j: any) => (
          <div className="card" key={j.id}>
            <Link href={`/stores/${j.store_id}`}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <h3>{j.title}</h3>
                {j.job_type && <span className="badge">{j.job_type}</span>}
              </div>
              <div className="muted">{j.stores?.name}</div>
              {j.salary && <p className="muted">{j.salary}</p>}
              {j.description && (
                <p style={{ marginTop: 6, fontSize: 13.5 }}>{j.description}</p>
              )}
            </Link>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <form
                action={async () => {
                  "use server";
                  await toggleFavoriteJob(j.id, "/jobs");
                }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  {favoriteJobIds.has(j.id) ? "★ お気に入り済み" : "☆ お気に入り"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await applyToJob(j.id, "/jobs");
                }}
              >
                <button
                  type="submit"
                  className={`btn ${appliedJobIds.has(j.id) ? "" : "primary"}`}
                  style={{ fontSize: 12.5 }}
                  disabled={appliedJobIds.has(j.id)}
                >
                  {appliedJobIds.has(j.id) ? "応募済み" : "応募する"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await reportJob(j.id, "/jobs");
                }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  通報
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
