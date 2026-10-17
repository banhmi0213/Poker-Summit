import { JobRoleSelect } from "@/app/job-role-select";
import { ReadableName } from "@/app/readable-name";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { createJob, toggleJobStatus, updateJob, deleteJob } from "../jobs-actions";
import { JOB_TYPE_OPTIONS } from "@/lib/constants";
import { getStorePlan, jobLimitOf, limitLabel } from "@/lib/plan-entitlements";
import { StoreContentRuleNotice } from "../content-rule-notice";
import { ConfirmButton } from "../confirm-button";
import s from "../manage.module.css";

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

  // 掲載枠はプランと有効な求人掲載アドオンで判定。既存求人の管理は常に表示。
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

  const jobList = jobs ?? [];
  const jobFields = (j?: (typeof jobList)[number]) => (
    <>
      <div className="field">
        <span>求人タイトル</span>
        <input type="text" name="title" required defaultValue={j?.title ?? ""} placeholder="例: ディーラー募集（未経験歓迎）" />
      </div>
      <JobRoleSelect value={j?.job_role ?? ""} />
      <div className="field">
        <span>雇用形態</span>
        <select name="jobType" defaultValue={j?.job_type ?? ""}>
          {j?.job_type && !JOB_TYPE_OPTIONS.includes(j.job_type) && <option hidden value={j.job_type}>{j.job_type}</option>}
          <option value="">選択してください</option>
          {JOB_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span>給与</span>
        <input type="text" name="salary" defaultValue={j?.salary ?? ""} placeholder="例: 時給1300円〜" />
      </div>
      <div className="field">
        <span>仕事内容</span>
        <textarea name="description" rows={4} defaultValue={j?.description ?? ""} />
      </div>
      <div className="field">
        <span>{j ? "バナー画像を差し替える（任意）" : "バナー画像（任意）"}</span>
        <input type="file" name="bannerImage" accept="image/*" capture="environment" />
      </div>
      {j?.banner_image_url && (
        <label className="muted small" style={{ display: "flex", alignItems: "center", gap: 8, margin: "-4px 0 14px", fontSize: 14 }}>
          <input type="checkbox" name="removeBanner" />
          現在のバナー画像を削除する
        </label>
      )}
    </>
  );

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>求人管理</h1>
      <StoreContentRuleNotice />

      {jobLimit !== 0 && (
        <p className={s.lead}>
          ご契約プラン：{storePlan?.planName}
          <br />
          募集中の求人 {openJobCount}件（{limitLabel(jobLimit)}）
        </p>
      )}

      {canCreateJob ? (
        <details className={`card ${s.add}`} open={jobList.length === 0}>
          <summary>
            <span className={s.plus} aria-hidden>＋</span>新しい求人を掲載する
          </summary>
          <div className={s.addBody}>
            <form action={createJob} encType="multipart/form-data">
              <input type="hidden" name="storeId" value={store.id} />
              {jobFields()}
              <button type="submit" className="btn primary">
                求人を掲載する
              </button>
            </form>
          </div>
        </details>
      ) : (
        <div className={`card ${s.limitCard}`}>
          {jobLimit === 0 ? (
            <>
              <p style={{ fontWeight: 700 }}>求人掲載アドオンで1件ずつ掲載できます</p>
              <p className="muted small">
                求人掲載1件は月額8,800円です。プレミアムプラン（月額33,000円）は求人を無制限で掲載できます。
              </p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 700 }}>現在のプランで募集できる求人数（{jobLimit}件）に達しています</p>
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

      {jobList.length > 0 && (
        <div className={s.listHead}>
          <h2>掲載した求人</h2>
          <span>{jobList.length}件</span>
        </div>
      )}

      {jobList.map((j) => {
        const applicants = jobApplicants[j.id] ?? [];
        const open = j.status === "open";
        return (
          <div className={`card ${s.item} ${open ? "" : s.closed}`} key={j.id}>
            <h3 className={s.itemTitle}><ReadableName name={j.title} /></h3>
            <div className={s.badges}>
              <span className={`badge ${open ? s.badgeOn : s.badgeOff}`}>{open ? "募集中" : "募集終了"}</span>
              {j.job_type ? <span className="badge outline">{j.job_type}</span> : <span className={`badge ${s.badgeWarn}`}>雇用形態が未設定</span>}
            </div>
            {j.banner_image_url && <img className={s.thumb} src={j.banner_image_url} alt="" loading="lazy" />}
            <div className={s.facts}>
              {j.salary && <span>{j.salary}</span>}
              <span className={s.sub}>
                応募 {jobApplicantCounts[j.id] ?? 0}件 ・ お気に入り {jobFavoriteCounts[j.id] ?? 0}件
              </span>
            </div>
            {!j.job_type && <p className={s.warn}>雇用形態を「内容を編集する」から選ぶと、求人一覧の絞り込みにも表示されます。</p>}
            <div className={s.actions}>
              <form
                action={async () => {
                  "use server";
                  await toggleJobStatus(j.id, store.id, open ? "closed" : "open");
                }}
              >
                <button type="submit" className="btn">
                  {open ? "募集を終了する" : "募集を再開する"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await deleteJob(j.id, store.id);
                }}
              >
                <ConfirmButton className={`btn ${s.danger}`} message={`「${j.title}」を削除しますか？応募の記録も見られなくなります。この操作は取り消せません。`}>
                  削除する
                </ConfirmButton>
              </form>
            </div>
            {applicants.length > 0 && (
              <details className={s.more}>
                <summary>応募者を見る（{applicants.length}件）</summary>
                <div className={s.moreBody}>
                  {applicants.map((a, i) => (
                    <div key={i} className={s.applicant}>
                      <div className={s.applicantHead}>
                        <strong>{a.name || "（お名前未入力）"}</strong>
                        <span>{new Date(a.applied_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 応募</span>
                      </div>
                      <p>
                        {[
                          a.age ? `${a.age}歳` : null,
                          a.gender ? GENDER_LABEL[a.gender] ?? a.gender : null,
                          a.dealer_experience ? DEALER_EXPERIENCE_LABEL[a.dealer_experience] ?? a.dealer_experience : null,
                        ]
                          .filter(Boolean)
                          .join(" ・ ") || "年齢・性別・ディーラー経験の入力なし"}
                      </p>
                      {a.address && <p>📍 {a.address}</p>}
                      {a.interview_date && (
                        <p>
                          <span className={s.label}>面接希望日 </span>
                          {new Date(a.interview_date).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                        </p>
                      )}
                      {a.message && (
                        <p style={{ whiteSpace: "pre-wrap" }}>
                          <span className={s.label}>メッセージ（PR） </span>
                          {a.message}
                        </p>
                      )}
                      {a.motivation && (
                        <p style={{ whiteSpace: "pre-wrap" }}>
                          <span className={s.label}>志望動機 </span>
                          {a.motivation}
                        </p>
                      )}
                      {(a.tel || a.email) && (
                        <div className={s.contact}>
                          {a.tel && <a href={`tel:${String(a.tel).replace(/[^+0-9]/g, "")}`}>📞 {a.tel}</a>}
                          {a.email && <a href={`mailto:${a.email}`}>✉️ {a.email}</a>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
            <details className={s.more}>
              <summary>内容を編集する</summary>
              <div className={s.moreBody}>
                <form action={updateJob} encType="multipart/form-data" className={s.editForm}>
                  <input type="hidden" name="storeId" value={store.id} />
                  <input type="hidden" name="jobId" value={j.id} />
                  {jobFields(j)}
                  <button type="submit" className="btn primary">
                    更新する
                  </button>
                </form>
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
