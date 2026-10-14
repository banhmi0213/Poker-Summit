import Link from "next/link";
import { COUPON_CATEGORIES, couponCategoryHref } from "@/lib/coupon-categories";
import styles from "./coupon-category-entrances.module.css";

export function CouponCategoryEntrances({ pref = "", area = "", region = "" }: { pref?: string; area?: string; region?: string }) {
  return <div className={styles.grid}>
    {COUPON_CATEGORIES.slice(0, 3).map(category => <Link className={styles.card} key={category.value}
      href={couponCategoryHref(category.value, pref, area, region)} aria-label={`${category.label}のクーポン一覧を見る`}>
      <span className={styles.artwork}>
        <img src="/images/coupon-categories-v1.webp" width={2172} height={724} loading="lazy" alt={category.label}
          style={{ left: `${-("x" in category ? category.x : 0) / 704 * 100}%` }} />
      </span>
    </Link>)}
  </div>;
}
