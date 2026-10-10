import { ReadableName } from "@/app/readable-name";
import Image from "next/image";

export function CompactPortalBanner({ image, eyebrow, title, subtitle, detail }: {
  image: string; eyebrow: string; title: string; subtitle: string; detail?: string;
}) {
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
      <h1><ReadableName name={title} /></h1>
      <p>{subtitle}</p>
      {detail && <small>{detail}</small>}
    </div>
    <div className="compact-portal-banner__photo">
      <picture>
        <source media="(max-width: 599px)" srcSet={mobileImages[image] ?? image} />
        <Image src={image} alt="" width={2172} height={724} priority quality={95} sizes="570px" />
      </picture>
    </div>
  </section>;
}
