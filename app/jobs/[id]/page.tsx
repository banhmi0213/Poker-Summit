import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toggleFavoriteJob, applyToJob } from "@/app/member-actions";
import { reportJob } from "@/app/report-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { CATEGORY_LABEL } from "@/lib/constants";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP");
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, title, job_type, salary, description, status, posted_at, banner_image_url, store_id, stores(id, name, category, pref, city, status)"
    )
    .eq("id", params.id)
    .maybeSingle();

  const j = job as any;
  if (!j || !j.stores || !["approved", "listed"].includes(j.stores.status)) {
    notFound();
  }

  const path = `/jobs/${j.id}`;

  let appliedByMe = false;
  let favJob = false;
  if (user) {
    const [{ data: app }, { data: fav }] = await Promise.all([
      supabase
        .from("job_applications")
        .select("job_id")
        .eq("user_id", user.id)
        .eq("job_id", j.id)
        .maybeSingle(),
      supabase
        .from("favorite_jobs")
        .select("job_id")
        .eq("user_id", user.id)
        .eq("job_id", j.id)
        .maybeSingle(),
    ]);
    appliedByMe = !!app;
    favJob = !!fav;
  }

  const { count: applicantCount } = await supabase
    .from("job_applications")
    .select("*", { count: "exact", head: true })
    .eq("job_id", j.id);

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container" style={{ maxWidth: 640 }}>
        <Link href="/jobs" className="breadcrumb">
          ← 求人一覧に戻る
        </Link>

        {j.banner_image_url && (
          <img
            src={j.banner_image_url}
            alt={j.title}
            style={{
              width: "100%",
              maxHeight: 280,
              objectFit: "cover",
              borderRadius: 14,
              marginBottom: 16,
              display: "block",
            }}
          />
        )}

        <div className="meta" style={{ marginBottom: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {j.stores?.category && (
            <span className="badge">{CATEGORY_LABEL[j.stores.category] ?? j.stores.category}</span>
          )}
          {j.job_type && <span className="badge outline">{j.job_type}</span>}
          <span className={`badge ${j.status === "open" ? "good" : "outline"}`}>
            {j.status === "open" ? "● 公開中" : "停止中"}
          </span>
        </div>

        <h1 style={{ fontSize: 22 }}>{j.title}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {j.stores?.name} ・ {j.stores?.pref}
          {j.stores?.city} ・ 掲載日 {formatDate(j.posted_at)}
        </p>

        <div className="card" style={{ marginTop: 18 }}>
          <div className="info-row">
            <div className="k">給与</div>
            <div style={{ fontWeight: 700, color: "var(--accent-text)" }}>{j.salary || "応相談"}</div>
          </div>
          <div className="info-row">
            <div className="k">雇用形態</div>
            <div>{j.job_type || "未設定"}</div>
          </div>
          <div className="info-row">
            <div className="k">仕事内容</div>
            <div>{j.description || "-"}</div>
          </div>
          <div className="info-row">
            <div className="k">応募状況</div>
            <div>{applicantCount ?? 0}件の応募</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {appliedByMe ? (
            <button type="button" className="btn" disabled>
              ✓ 応募済み
            </button>
          ) : j.status === "open" ? (
            <form
              action={async () => {
                "use server";
                await applyToJob(j.id, path);
              }}
            >
              <button type="submit" className="btn primary">
                この求人に応募する
              </button>
            </form>
          ) : (
            <button type="button" className="btn" disabled>
              募集終了
            </button>
          )}
          <form
            action={async () => {
              "use server";
              await toggleFavoriteJob(j.id, path);
            }}
          >
            <button type="submit" className={`btn ${favJob ? "primary" : ""}`}>
              {favJob ? "★ お気に入り済み" : "☆ お気に入りに追加(あとで応募)"}
            </button>
          </form>
          <Link href={`/stores/${j.stores.id}`} className="btn">
            この店舗のページを見る
          </Link>
          <form
            action={async () => {
              "use server";
              await reportJob(j.id, path);
            }}
          >
            <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
              通報
            </button>
          </form>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs active="jobs" />
    </div>
  );
}
