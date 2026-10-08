import { ReadableName } from "@/app/readable-name";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toggleFavoriteJob, submitJobApplication } from "@/app/member-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { CATEGORY_LABEL } from "@/lib/constants";
import { pickBanner } from "@/lib/banners";
import { AgeField, GenderField, DealerExperienceField } from "./applicant-attributes";
import type { Metadata } from "next";
import { SITE_NAME, absoluteUrl, clip, pageTitle } from "@/lib/seo";
import { JsonLd } from "@/lib/json-ld";

const JOB_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMPLOYMENT_TYPE: Record<string, string> = {
  正社員: "FULL_TIME",
  契約社員: "TEMPORARY",
  パート: "PART_TIME",
  アルバイト: "PART_TIME",
  業務委託: "CONTRACTOR",
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  if (!JOB_UUID.test(params.id)) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("id,title,job_type,salary,description,status,banner_image_url,stores(name,category,pref,city,status)").eq("id", params.id).maybeSingle();
  const j = data as any;
  if (!j || !j.stores || !["approved", "listed"].includes(j.stores.status)) return {};
  const area = `${j.stores.pref ?? ""}${j.stores.city ?? ""}`;
  const kind = (j.stores.category && CATEGORY_LABEL[j.stores.category]) || "ポーカー店";
  const title = pageTitle(`${j.title}｜${j.stores.name}${area ? `（${area}）` : ""}の求人`);
  const head = [area && `${area}の${kind}`, `「${j.stores.name}」の`, j.job_type, "求人"].filter(Boolean).join("");
  const description = clip(`${head}。${j.salary ? `給与：${j.salary}。` : ""}${j.description ?? ""}`, 160);
  const path = `/jobs/${j.id}`;
  const image = j.banner_image_url || undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, locale: "ja_JP", type: "website", ...(image ? { images: [{ url: image, alt: j.title }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
    // 募集終了の求人は検索結果に残さない
    ...(j.status !== "open" ? { robots: { index: false, follow: true } } : {}),
  };
}

function jobPostingJsonLd(j: any) {
  const store = j.stores;
  const posted = j.posted_at || j.created_at;
  const description = [j.description, j.salary && `給与：${j.salary}`].filter(Boolean).join("\n\n") || j.title;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: j.title,
    description,
    url: absoluteUrl(`/jobs/${j.id}`),
    hiringOrganization: { "@type": "Organization", name: store.name, sameAs: absoluteUrl(`/stores/${store.id}`) },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "JP",
        ...(store.pref ? { addressRegion: store.pref } : {}),
        ...(store.city ? { addressLocality: store.city } : {}),
        ...(store.address ? { streetAddress: store.address } : {}),
      },
    },
  };
  if (posted) data.datePosted = posted;
  if (j.job_type && EMPLOYMENT_TYPE[j.job_type]) data.employmentType = EMPLOYMENT_TYPE[j.job_type];
  return data;
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP");
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { applyError?: string; applyDone?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, title, job_type, salary, description, status, posted_at, created_at, banner_image_url, store_id, stores(id, name, category, pref, city, address, tel, status)"
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

  const jobDetailBanner = await pickBanner(supabase, "job_detail", { pref: j.stores?.pref });
  const phone = j.stores?.tel ? String(j.stores.tel).replace(/[^+0-9]/g, "") : "";

  return (
    <div>
      {j.status === "open" && <JsonLd data={jobPostingJsonLd(j)} />}
      <PortalHeader userEmail={user?.email} />
      <div className="container detail-readable" style={{ maxWidth: 640 }}>
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

        <h1 style={{ fontSize: 22 }}><ReadableName name={j.title} /></h1>
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
          {phone && (
            <a href={`tel:${phone}`} className="btn primary">
              電話をかける
            </a>
          )}
          {appliedByMe ? (
            <button type="button" className="btn" disabled>
              ✓ 応募済み
            </button>
          ) : j.status !== "open" ? (
            <button type="button" className="btn" disabled>
              募集終了
            </button>
          ) : null}
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
        </div>

        {searchParams.applyDone && (
          <div className="card" style={{ marginTop: 18, background: "var(--good-soft)" }}>
            <p style={{ fontSize: 13.5 }}>✓ 応募を受け付けました。店舗からの連絡をお待ちください。</p>
          </div>
        )}

        {!appliedByMe && j.status === "open" && (
          <div id="apply" style={{ marginTop: 18, scrollMarginTop: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 10 }}>この求人に応募する</h2>
            {searchParams.applyError && <p className="err">{searchParams.applyError}</p>}
            <form action={submitJobApplication}>
              <input type="hidden" name="jobId" value={j.id} />
              <input type="hidden" name="path" value={path} />
              <div className="card">
                <div className="field">
                  <span className="muted">お名前 *</span>
                  <input type="text" name="name" required defaultValue={user?.user_metadata?.name ?? ""} />
                </div>
                <AgeField />
                <GenderField />
                <div className="field">
                  <span className="muted">住所</span>
                  <input type="text" name="address" />
                </div>
                <div className="field">
                  <span className="muted">電話番号</span>
                  <input type="tel" name="tel" />
                </div>
                <div className="field">
                  <span className="muted">メールアドレス</span>
                  <input type="email" name="email" defaultValue={user?.email ?? ""} />
                </div>
                <DealerExperienceField />
                <div className="field">
                  <span className="muted">志望動機</span>
                  <textarea name="motivation" rows={4} placeholder="志望動機をご記入ください" />
                </div>
                <div className="field">
                  <span className="muted">面接希望日</span>
                  <input type="date" name="interviewDate" />
                </div>
                <div className="field">
                  <span className="muted">メッセージ（PR）</span>
                  <textarea name="message" rows={4} placeholder="自己PRやアピールポイントがあればご記入ください" />
                </div>
                <button type="submit" className="btn primary" style={{ width: "100%" }}>
                  応募を送信する
                </button>
              </div>
            </form>
          </div>
        )}

        {jobDetailBanner && (
          <a
            href={`/go/banner/${jobDetailBanner.id}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "block", marginTop: 24 }}
          >
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {jobDetailBanner.image_url ? (
                <img src={jobDetailBanner.image_url} alt={jobDetailBanner.title} style={{ width: "100%", display: "block" }} />
              ) : (
                <div style={{ padding: 16 }}>{jobDetailBanner.title}</div>
              )}
            </div>
          </a>
        )}
      </div>
      <PortalFooter />
      <BottomTabs active="jobs" />
    </div>
  );
}
