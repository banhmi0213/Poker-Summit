import type { HomeBanner } from "./home-banner-slider";
import styles from "./home-section-banners.module.css";

/** Banner rows are hidden entirely when no active image exists. */
export function HomeSectionBanners({ banners, layout }: { banners: HomeBanner[]; layout: "wide" | "four" }) {
  const visible = banners.slice(0, layout === "four" ? 4 : 1);
  if (!visible.length) return null;
  return (
    <div className={layout === "four" ? styles.four : styles.wide} aria-label="掲載バナー">
      {visible.map((b) => {
        const image = <img src={b.image_url} alt={b.title} loading="lazy" />;
        return b.link_url ? (
          <a key={b.id} className={styles.banner} href={b.link_url} target={b.external ? "_blank" : undefined} rel={b.external ? "noopener noreferrer" : undefined}>{image}</a>
        ) : <div key={b.id} className={styles.banner}>{image}</div>;
      })}
    </div>
  );
}
