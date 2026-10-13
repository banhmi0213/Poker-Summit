import type { HomeBanner } from "./home-banner-slider";
import { bannersForDevice } from "@/lib/banners";
import styles from "./home-section-banners.module.css";

/** Banner rows are hidden entirely when no active image exists. */
function DeviceSectionBanners({ banners, layout, device, pickup }: { banners: HomeBanner[]; layout: "wide" | "four"; device: "pc" | "mobile"; pickup?: boolean }) {
  const visible = bannersForDevice(banners, device).slice(0, layout === "four" ? 4 : 1);
  if (!visible.length) return null;
  return (
    <div className={`${device === "pc" ? "banner-pc-only" : "banner-mobile-only"} ${layout === "four" ? styles.four : styles.wide} ${pickup ? styles.pickup : ""}`} aria-label="掲載バナー">
      {visible.map((b) => {
        const isJobsArtwork = b.image_url === "/images/jobs-banner-light-v5.png";
        const image = isJobsArtwork ? (
          <span className={styles.jobsComposition} role="img" aria-label={b.title}>
            <span className={styles.jobsLeft}><img src={b.image_url} alt="" width={1707} height={341} loading="lazy" decoding="async" /></span>
            <span className={styles.jobsRight}><img src={b.image_url} alt="" width={1707} height={341} loading="lazy" decoding="async" /></span>
            <span className={styles.jobsCopy}>
              <span className={styles.jobsTitle}>新着求人・スポット求人</span>
              <span className={styles.jobsIcon} aria-hidden="true"><svg viewBox="0 0 48 40" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M13 7H8v29h24V7h-5M17 7V3h6v4h4v5H13V7h4Z"/><circle cx="20" cy="20" r="4"/><path d="M13 30c0-8 14-8 14 0"/><circle cx="36" cy="25" r="8"/><path d="M36 21v8m-4-4h8"/></svg></span>
              <span className={styles.jobsSubtitle}>ポーカーが好き。その気持ちが、仕事のきっかけに。</span>
            </span>
          </span>
        ) : <img src={b.image_url} alt={b.title} loading="lazy" style={b.image_url?.match(/-banner-light-v\d+\.webp$/) ? { aspectRatio: "auto", objectFit: "contain" } : undefined} />;
        return b.link_url ? (
          <a key={b.id} className={`${styles.banner} ${isJobsArtwork ? styles.jobsArtwork : ""}`} href={b.link_url} target={b.external ? "_blank" : undefined} rel={b.external ? "noopener noreferrer" : undefined}>{image}</a>
        ) : <div key={b.id} className={`${styles.banner} ${isJobsArtwork ? styles.jobsArtwork : ""}`}>{image}</div>;
      })}
    </div>
  );
}

export function HomeSectionBanners(props: { banners: HomeBanner[]; layout: "wide" | "four"; pickup?: boolean }) {
  return <><DeviceSectionBanners {...props} device="pc" /><DeviceSectionBanners {...props} device="mobile" /></>;
}
