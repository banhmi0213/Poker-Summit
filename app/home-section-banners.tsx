import type { HomeBanner } from "./home-banner-slider";
import { bannersForDevice } from "@/lib/banners";
import { mobileSectionBanner } from "@/lib/mobile-section-banner";
import styles from "./home-section-banners.module.css";

/** Banner rows are hidden entirely when no active image exists. */
function DeviceSectionBanners({ banners, layout, device, pickup }: { banners: HomeBanner[]; layout: "wide" | "four"; device: "pc" | "mobile"; pickup?: boolean }) {
  const visible = bannersForDevice(banners, device).slice(0, layout === "four" ? 4 : 1);
  if (!visible.length) return null;
  return (
    <div className={`${device === "pc" ? "banner-pc-only" : "banner-mobile-only"} ${layout === "four" ? styles.four : styles.wide} ${pickup ? styles.pickup : ""}`} aria-label="掲載バナー">
      {visible.map((b) => {
        const isJobsArtwork = b.image_url === "/images/jobs-banner-light-v6.webp";
        const mobile = device === "mobile" && layout === "wide" ? mobileSectionBanner(b.image_url) : null;
        const image = mobile ? <div className={styles.mobileArtwork}><div className={styles.mobileCopy}><strong>{mobile.title}</strong><p>{mobile.description}</p>{b.link_url && <span>詳しく見る →</span>}</div><img src={mobile.photo} alt="" loading="lazy" decoding="async" width={600} height={600} /></div> : <img src={b.image_url} alt={b.title} width={isJobsArtwork ? 2066 : undefined} height={isJobsArtwork ? 761 : undefined} loading="lazy" decoding={isJobsArtwork ? "async" : undefined} style={b.image_url?.match(/-banner-light-v\d+\.webp$/) ? { aspectRatio: isJobsArtwork ? "2066 / 761" : "auto", objectFit: "contain" } : undefined} />;
        return b.link_url ? (
          <a key={b.id} className={`${styles.banner} ${isJobsArtwork && !mobile ? styles.jobsArtwork : ""}`} href={b.link_url} target={b.external ? "_blank" : undefined} rel={b.external ? "noopener noreferrer" : undefined}>{image}</a>
        ) : <div key={b.id} className={`${styles.banner} ${isJobsArtwork && !mobile ? styles.jobsArtwork : ""}`}>{image}</div>;
      })}
    </div>
  );
}

export function HomeSectionBanners(props: { banners: HomeBanner[]; layout: "wide" | "four"; pickup?: boolean }) {
  return <><DeviceSectionBanners {...props} device="pc" /><DeviceSectionBanners {...props} device="mobile" /></>;
}
