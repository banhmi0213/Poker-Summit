import type { HomeBanner } from "./home-banner-slider";
import { bannersForDevice } from "@/lib/banners";
import styles from "./home-section-banners.module.css";

/** Banner rows are hidden entirely when no active image exists. */
function DeviceSectionBanners({ banners, layout, device }: { banners: HomeBanner[]; layout: "wide" | "four"; device: "pc" | "mobile" }) {
  const visible = bannersForDevice(banners, device).slice(0, layout === "four" ? 4 : 1);
  if (!visible.length) return null;
  return (
    <div className={`${device === "pc" ? "banner-pc-only" : "banner-mobile-only"} ${layout === "four" ? styles.four : styles.wide}`} aria-label="掲載バナー">
      {visible.map((b) => {
        const image = <img src={b.image_url} alt={b.title} loading="lazy" style={b.image_url?.match(/-banner-light-v\d+\.webp$/) ? { aspectRatio: "auto", objectFit: "contain" } : undefined} />;
        return b.link_url ? (
          <a key={b.id} className={styles.banner} href={b.link_url} target={b.external ? "_blank" : undefined} rel={b.external ? "noopener noreferrer" : undefined}>{image}</a>
        ) : <div key={b.id} className={styles.banner}>{image}</div>;
      })}
    </div>
  );
}

export function HomeSectionBanners(props: { banners: HomeBanner[]; layout: "wide" | "four" }) {
  return <><DeviceSectionBanners {...props} device="pc" /><DeviceSectionBanners {...props} device="mobile" /></>;
}
