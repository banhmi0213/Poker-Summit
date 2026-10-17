import styles from "./compact-portal-copy.module.css";
import { ReadableName } from "@/app/readable-name";
import Image from "next/image";

export function CompactPortalBanner({ image, eyebrow, title, titleParts, subtitle, detail, subtitleParts, detailParts, heading = "h1" }: {
  image: string; eyebrow: string; title: string; subtitle: string; detail?: string; subtitleParts?: string[]; detailParts?: string[];
  /** 見出しの改行位置(例: ["トーナメント・", "イベントを探す"])。1〜2文字だけ次の行に落ちるのを防ぐ */
  titleParts?: string[];
  /** ページ内に別の h1 がある場合は "h2" にする(h1はページに1つだけ) */
  heading?: "h1" | "h2";
}) {
  const Heading = heading;
  const mobileImages: Record<string, string> = {
    "/images/compact-careers.webp": "/images/mobile-careers.webp",
    "/images/compact-news.webp": "/images/mobile-news.webp",
    "/images/compact-events.webp": "/images/mobile-events.webp",
    "/images/compact-coupons.webp": "/images/mobile-coupons.webp",
    "/images/compact-community.webp": "/images/mobile-community.webp",
    "/images/poker-store-finder-banner.webp": "/images/mobile-stores.webp",
  };
  return <section className="compact-portal-banner" aria-label={title}>
    <div className="compact-portal-banner__copy">
      <span className="compact-portal-banner__eyebrow">{eyebrow}</span>
      <Heading>{titleParts ? titleParts.map((part, i) => <span key={i} className={styles.word}>{part}</span>) : <ReadableName name={title} />}</Heading>
      <p>{subtitleParts ? subtitleParts.map((part, i) => <span key={i} className={styles.word}>{part}</span>) : subtitle}</p>
      {detail && <small>{detailParts ? detailParts.map((part, i) => <span key={i} className={styles.word}>{part}</span>) : detail}</small>}
    </div>
    <div className="compact-portal-banner__photo">
      <picture>
        <source media="(max-width: 599px)" srcSet={mobileImages[image] ?? image} />
        <Image src={image} alt="" width={2172} height={724} priority quality={95} sizes="570px" />
      </picture>
    </div>
  </section>;
}
