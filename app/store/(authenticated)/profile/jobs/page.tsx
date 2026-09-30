import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { createJob, toggleJobStatus, updateJob, deleteJob } from "../jobs-actions";
import { JOB_TYPE_OPTIONS } from "@/lib/constants";
import { storeHasJobsAddon } from "@/lib/store-addons";

// 以前は/store/profile 1ページの中の1セクションだった求人管理を、独立した
// ページへ分離(2026/09/30)。「求人を押したのにクーポンまで出てくる」との
// 指摘を受け、各メニュー項目を完全に別ページにする構成へ揃えた。
// バナー画像はURL入力ではなく、店舗写真と同じくファイルを直接アップロード
// できるようにしている(2026/09/30)。
export default async function StoreJobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/store/login?next=/store/profile/jobs");
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

  // 求人掲載アドオン(月額11,000円/1件)を契約していない店舗には、求人
  // 管理画面を触らせない(2026/09/30、「求人はアドオンしてないと触れない
  // ようにして」との指示)。
  const hasJobsAddon = await storeHasJobsAddon(supabase, store.id);
  if (!hasJobsAddon) {
    return (
      <div>
        <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
          ← 店舗管理に戻る
        </Link>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>求人管理</h1>
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: 6 }}>
            求人機能は「求人掲載」アドオンのご契約が必要です
          </p>
          <p className="muted small">
            月額11,000円（求人1件につき）でご利用いただけます。ご契約は運営までお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("store_id", store.id)
    .order("posted_at", { ascending: false });

  const jobIds = (jobs ?? []).map((j) => j.id);

  const [{ data: appRows }, { data: jobFavRows }] = await Promise.all([
    jobIds.length
      ? supabase.from("job_applications").select("job_id").in("job_id", jobIds)
      : Promise.resolve({ data: [] as { job_id: string }[] }),
    jobIds.length
      ? supabase.from("favorite_jobs").select("job_id").in("job_id", jobIds)
      : Promise.resolve({ data: [] as { job_id: string }[] }),
  ]);

  const jobApplicantCounts: Record<string, number> = {};
  const jobFavoriteCounts: Record<string, number> = {};
  appRows?.forEach((r) => {
    jobApplicantCounts[r.job_id] = (jobApplicantCounts[r.job_id] ?? 0) + 1;
  });
  jobFavRows?.forEach((r) => {
    jobFavoriteCounts[r.job_id] = (jobFavoriteCounts[r.job_id] ?? 0) + 1;
  });

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>求人管理</h1>

      <div className="card">
        <form action={createJob} encType="multipart/form-data">
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
          <div className="field">
            <span className="muted">バナー画像（任意）</span>
            <input type="file" name="bannerImage" accept="image/*" capture="environment" />
          </div>
          <button type="submit" className="btn primary">
            求人を掲載する
          </button>
        </form>
      </div>

      {jobs?.map((j) => (
        <div className="card" key={j.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3>{j.title}</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <span className="badge outline">{j.job_type || "雇用形態未設定"}</span>
              <span className="badge">{j.status === "open" ? "募集中" : "終了"}</span>
            </div>
          </div>
          {j.banner_image_url && (
            <img
              src={j.banner_image_url}
              alt=""
              style={{ width: "100%", maxWidth: 320, borderRadius: 8, marginTop: 8, objectFit: "cover" }}
            />
          )}
          {j.salary && <p className="muted">{j.salary}</p>}
          <p className="muted small" style={{ marginTop: 4 }}>
            応募数: {jobApplicantCounts[j.id] ?? 0}件 ・ お気に入り数: {jobFavoriteCounts[j.id] ?? 0}件
            {!j.job_type && " ・ ⚠️ 雇用形態が未設定です"}
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <form
              action={async () => {
                "use server";
                await toggleJobStatus(j.id, store.id, j.status === "open" ? "closed" : "open");
              }}
            >
              <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                {j.status === "open" ? "募集を終了する" : "募集を再開する"}
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await deleteJob(j.id, store.id);
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
            <form action={updateJob} encType="multipart/form-data" style={{ marginTop: 10 }}>
              <input type="hidden" name="storeId" value={store.id} />
              <input type="hidden" name="jobId" value={j.id} />
              <div className="field">
                <span className="muted">求人タイトル</span>
                <input type="text" name="title" required defaultValue={j.title} />
              </div>
              <div className="field">
                <span className="muted">雇用形態</span>
                <select name="jobType" defaultValue={j.job_type ?? ""}>
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
                <input type="text" name="salary" defaultValue={j.salary ?? ""} />
              </div>
              <div className="field">
                <span className="muted">仕事内容</span>
                <textarea name="description" rows={3} defaultValue={j.description ?? ""} />
              </div>
              <div className="field">
                <span className="muted">バナー画像を差し替える（任意）</span>
                <input type="file" name="bannerImage" accept="image/*" capture="environment" />
              </div>
              {j.banner_image_url && (
                <label className="muted small" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <input type="checkbox" name="removeBanner" />
                  現在のバナー画像を削除する
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
