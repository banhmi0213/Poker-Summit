import Image from "next/image";

export function CompactPortalBanner({ image, eyebrow, title, subtitle, detail }: {
  image: string; eyebrow: string; title: string; subtitle: string; detail?: string;
}) {
  return <section className="compact-portal-banner" aria-label={title}>
    <div className="compact-portal-banner__copy">
      <span className="compact-portal-banner__eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {detail && <small>{detail}</small>}
    </div>
    <div className="compact-portal-banner__photo">
      <Image src={image} alt="" width={2172} height={724} priority quality={95} sizes="570px" />
    </div>
  </section>;
}
