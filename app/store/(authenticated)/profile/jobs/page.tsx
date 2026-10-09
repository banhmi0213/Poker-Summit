import { ReadableName } from "@/app/readable-name";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { createJob, toggleJobStatus, updateJob, deleteJob } from "../jobs-actions";
import { JOB_TYPE_OPTIONS } from "@/lib/constants";
import { getStorePlan, jobLimitOf, limitLabel } from "@/lib/plan-entitlements";

const GENDER_LABEL: Record<string, string> = { male: "男性", female: "女性" };
const DEALER_EXPERIENCE_LABEL: Record<string, string> = {
  none: "ディーラー経験なし",
  under_1y: "ディーラー経験あり（1年未満）",
  over_1y: "ディーラー経験あり（1年以上）",
};

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

  // 求人掲載アドオン(月額11,000円/1件)の契約有無。以前はこれが false の場合
  // ページ全体(既存求人の一覧・編集・削除まで)を丸ごと隠していたが、それだと
  // 管理側が代理掲載した求人をオーナーが一切管理できなくなってしまうバグが
  // あったため、「新規に求人を掲載する」フォームの部分だけ契約案内に差し替える
  // 形に変更(2026/10、「店舗管理画面でも求人は見えるようにして求人だそうとし
  // たら契約のアナウンスを出して」との指示)。
  // 求人の掲載数は契約プランで決まる(2026/10、ライト0件/スタンダード3件/
  // プレミアム無制限)。既存求人の一覧・編集・募集終了はプランに関係なく使える。
  const storePlan = await getStorePlan(supabase, store.id);
  const jobLimit = jobLimitOf(storePlan);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("store_id", store.id)
    .order("posted_at", { ascending: false });

  const jobIds = (jobs ?? []).map((j) => j.id);

  // 店舗管理画面トップ(/store/profile)の「新着応募」アナウンスは
  // viewed_by_store_at が null の応募件数で判定しているため、この求人管理
  // ページを開いたタイミングでまとめて既読にする(2026/10、「求人通知の
  // LINE、メールやけど店管理画面でアナウンス出るようにしよか」との指示を
  // 受けて追加)。job_applicationsには店舗オーナー向けのUPDATEポリシーが
  // ないため、既読フラグだけを更新するsecurity definer RPC経由で行う
  // (mark_job_applications_viewed_for_my_store()参照)。失敗してもページ
  // 表示自体は止めない。
  if (jobIds.length) {
    await supabase.rpc("mark_job_applications_viewed_for_my_store");
  }

  const [{ data: appRows }, { data: jobFavRows }] = await Promise.all([
    jobIds.length
      ? supabase
          .from("job_applications")
          .select(
            "job_id, name, tel, email, message, age, gender, dealer_experience, address, interview_date, motivation, applied_at"
          )
          .in("job_id", jobIds)
          .order("applied_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            job_id: string;
            name: string | null;
            tel: string | null;
            email: string | null;
            message: string | null;
            age: number | null;
            gender: string | null;
            dealer_experience: string | null;
            address: string | null;
            interview_date: string | null;
            motivation: string | null;
            applied_at: string;
          }[],
        }),
    jobIds.length
      ? supabase.from("favorite_jobs").select("job_id").in("job_id", jobIds)
      : Promise.resolve({ data: [] as { job_id: string }[] }),
  ]);

  const jobApplicantCounts: Record<string, number> = {};
  const jobFavoriteCounts: Record<string, number> = {};
  const jobApplicants: Record<
    string,
    {
      name: string | null;
      tel: string | null;
      email: string | null;
      message: string | null;
      age: number | null;
      gender: string | null;
      dealer_experience: string | null;
      address: string | null;
      interview_date: string | null;
      motivation: string | null;
      applied_at: string;
    }[]
  > = {};
  appRows?.forEach((r) => {
    jobApplicantCounts[r.job_id] = (jobApplicantCounts[r.job_id] ?? 0) + 1;
    (jobApplicants[r.job_id] ??= []).push({
      name: r.name,
      tel: r.tel,
      email: r.email,
      message: r.message,
      age: r.age,
      gender: r.gender,
      dealer_experience: r.dealer_experience,
      address: r.address,
      interview_date: r.interview_date,
      motivation: r.motivation,
      applied_at: r.applied_at,
    });
  });
  jobFavRows?.forEach((r) => {
    jobFavoriteCounts[r.job_id] = (jobFavoriteCounts[r.job_id] ?? 0) + 1;
  });

  const openJobCount = (jobs ?? []).filter((j) => j.status === "open").length;
  const canCreateJob = jobLimit === null || openJobCount < jobLimit;

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>求人管理</h1>

      {jobLimit !== 0 && (
        <p className="muted small" style={{ marginBottom: 12 }}>
          ご契約プラン：{storePlan?.planName}　／　募集中の求人 {openJobCount}件（{limitLabel(jobLimit)}）
        </p>
      )}

      {canCreateJob ? (
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
      ) : (
        <div className="card">
          {jobLimit === 0 ? (
            <>
              <p style={{ fontWeight: 700, marginBottom: 6 }}>
                求人の掲載はスタンダードプラン以上でご利用いただけます
              </p>
              <p className="muted small">
                スタンダードプラン（月額16,500円）は求人3件まで、プレミアムプラン（月額33,000円）は無制限で掲載できます。
              </p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 700, marginBottom: 6 }}>
                現在のプランで募集できる求人数（{jobLimit}件）に達しています
              </p>
              <p className="muted small">
                新しく掲載する場合は、ほかの求人を募集終了にするか、プレミアムプラン（求人無制限）への変更をご検討ください。
              </p>
            </>
          )}
          <Link href="/store/profile/plan" className="btn" style={{ marginTop: 10, display: "inline-flex" }}>
            プランを確認・変更する →
          </Link>
        </div>
      )}

      {jobs?.map((j) => (
        <div className="card" key={j.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3><ReadableName name={j.title} /></h3>
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
          {(jobApplicants[j.id]?.length ?? 0) > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary className="muted small" style={{ cursor: "pointer" }}>
                応募者一覧（{jobApplicants[j.id].length}件）
              </summary>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                {jobApplicants[j.id].map((a, i) => (
                  <div key={i} className="card" style={{ background: "var(--surface-2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <strong>{a.name || "（お名前未入力）"}</strong>
                      <span className="muted small">
                        {new Date(a.applied_at).toLocaleString("ja-JP")}
                      </span>
                    </div>
                    <p className="muted small" style={{ marginTop: 4 }}>
                      {[
                        a.age ? `${a.age}歳` : null,
                        a.gender ? GENDER_LABEL[a.gender] ?? a.gender : null,
                        a.dealer_experience ? DEALER_EXPERIENCE_LABEL[a.dealer_experience] ?? a.dealer_experience : null,
                      ]
                        .filter(Boolean)
                        .join(" ・ ") || "年齢・性別・ディーラー経験の入力なし"}
                    </p>
                    {a.tel && (
                      <p className="muted small" style={{ marginTop: 4 }}>
                        <a href={`tel:${String(a.tel).replace(/[^+0-9]/g, "")}`}>{a.tel}</a>
                      </p>
                    )}
                    {a.email && (
                      <p className="muted small" style={{ marginTop: 4 }}>
                        <a href={`mailto:${a.email}`}>{a.email}</a>
                      </p>
                    )}
                    {a.address && (
                      <p className="muted small" style={{ marginTop: 4 }}>📍 {a.address}</p>
                    )}
                    {a.interview_date && (
                      <p className="muted small" style={{ marginTop: 4 }}>
                        面接希望日: {new Date(a.interview_date).toLocaleDateString("ja-JP")}
                      </p>
                    )}
                    {a.message && (
                      <p style={{ marginTop: 6, fontSize: 13.5, whiteSpace: "pre-wrap" }}>
                        <span className="muted small">メッセージ（PR）: </span>
                        {a.message}
                      </p>
                    )}
                    {a.motivation && (
                      <p style={{ marginTop: 6, fontSize: 13.5, whiteSpace: "pre-wrap" }}>
                        <span className="muted small">志望動機: </span>
                        {a.motivation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
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
