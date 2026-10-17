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
        const isPickupArtwork = b.image_url?.endsWith("/d5fb6e30-3b52-4af7-8c67-32dbff32849f.webp");
        const imageUrl = isPickupArtwork ? "/images/pickup-gold-v2.webp" : b.image_url === "/images/jobs-banner-light-v6.webp" ? "/images/jobs-banner-gold-v7.png" : b.image_url === "/images/coupon-banner-light-v3.webp" ? "/images/coupon-banner-gold-v4.png" : b.image_url;
        const isCouponArtwork = imageUrl === "/images/coupon-banner-gold-v4.png";
        const isJobsArtwork = b.image_url === "/images/jobs-banner-light-v6.webp";
        const image = <img src={imageUrl} alt={b.title} width={isJobsArtwork ? 2066 : undefined} height={isJobsArtwork ? 761 : undefined} loading="lazy" decoding={isJobsArtwork ? "async" : undefined} style={isCouponArtwork || isPickupArtwork ? { objectFit: "cover" } : b.image_url?.match(/-banner-light-v\d+\.webp$/) ? { aspectRatio: isJobsArtwork ? "2066 / 761" : "auto", objectFit: "contain" } : undefined} />;
        return b.link_url ? (
          <a key={b.id} className={`${styles.banner} ${isJobsArtwork ? styles.jobsArtwork : isCouponArtwork ? styles.couponArtwork : isPickupArtwork ? styles.pickupArtwork : ""}`} href={b.link_url} target={b.external ? "_blank" : undefined} rel={b.external ? "noopener noreferrer" : undefined}>{image}</a>
        ) : <div key={b.id} className={`${styles.banner} ${isJobsArtwork ? styles.jobsArtwork : isCouponArtwork ? styles.couponArtwork : isPickupArtwork ? styles.pickupArtwork : ""}`}>{image}</div>;
      })}
    </div>
  );
}

export function HomeSectionBanners(props: { banners: HomeBanner[]; layout: "wide" | "four"; pickup?: boolean }) {
  return <><DeviceSectionBanners {...props} device="pc" /><DeviceSectionBanners {...props} device="mobile" /></>;
}
