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
        const isJobsArtwork = b.image_url === "/images/jobs-banner-light-v3.webp";
        const image = <img src={b.image_url} alt={b.title} width={isJobsArtwork ? 2167 : undefined} height={isJobsArtwork ? 726 : undefined} loading="lazy" decoding={isJobsArtwork ? "async" : undefined} style={b.image_url?.match(/-banner-light-v\d+\.webp$/) ? { aspectRatio: isJobsArtwork ? "2167 / 726" : "auto", objectFit: "contain" } : undefined} />;
        return b.link_url ? (
          <a key={b.id} className={styles.banner} href={b.link_url} target={b.external ? "_blank" : undefined} rel={b.external ? "noopener noreferrer" : undefined}>{image}</a>
        ) : <div key={b.id} className={styles.banner}>{image}</div>;
      })}
    </div>
  );
}

export function HomeSectionBanners(props: { banners: HomeBanner[]; layout: "wide" | "four"; pickup?: boolean }) {
  return <><DeviceSectionBanners {...props} device="pc" /><DeviceSectionBanners {...props} device="mobile" /></>;
}
