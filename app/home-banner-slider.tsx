"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./home-banner-slider.module.css";

// TOPページ「開催予定のトーナメント・イベント」直上のバナースライダー
// (2026/10追加)。表示する行は総合管理画面 > バナー管理で position='top'
// として登録したもの(lib/banners.ts の getTopBanners で取得)。
// 1件なら静止表示、2件以上で5秒ごとの自動切替・前後矢印・ドット・
// スワイプ(横スクロールのscroll-snap)に対応する。ホバー/フォーカス/
// タッチ中と prefers-reduced-motion のときは自動切替しない。

export type HomeBanner = {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  external: boolean;
};

const INTERVAL_MS = 5000;

// 表示・クリック計測。sendBeaconならクリック直後に画面遷移しても送信が
// 途中で捨てられない。失敗しても表示・遷移は止めない。
function track(type: "impression" | "click", bannerId: string) {
  try {
    const body = JSON.stringify({ type, bannerId });
    if (navigator.sendBeacon?.("/api/banners/track", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/banners/track", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 計測失敗は無視する
  }
}

function BannerImage({ banner, index }: { banner: HomeBanner; index: number }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.image_url}
      alt={banner.title}
      width={1200}
      height={400}
      loading={index === 0 ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  );
  if (!banner.link_url) return img;
  return (
    <a
      href={banner.link_url}
      {...(banner.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={() => track("click", banner.id)}
    >
      {img}
    </a>
  );
}

export function HomeBannerSlider({ banners }: { banners: HomeBanner[] }) {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(false);
  const count = banners.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // 画面内に半分以上見えているときだけ「表示」とみなす(計測・自動切替)。
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.5),
      { threshold: [0, 0.5] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 各バナーが初めて表示されたときに1回だけbanner_impressionsへ記録する。
  useEffect(() => {
    if (!visible) return;
    const banner = banners[index];
    if (banner && !seen.current.has(banner.id)) {
      seen.current.add(banner.id);
      track("impression", banner.id);
    }
  }, [visible, index, banners]);

  const goTo = useCallback(
    (target: number) => {
      const el = trackRef.current;
      if (!el || count === 0) return;
      const next = (target + count) % count;
      el.scrollTo({ left: next * el.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
      setIndex(next);
    },
    [count, reducedMotion]
  );

  // スワイプ(横スクロール)後に、いま表示されているスライド番号へ合わせる。
  const onScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const current = Math.round(el.scrollLeft / el.clientWidth);
    if (current !== index && current >= 0 && current < count) setIndex(current);
  };

  const paused = hovered || focused || touching;
  useEffect(() => {
    if (count < 2 || paused || reducedMotion || !visible) return;
    const timer = window.setTimeout(() => goTo(index + 1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [count, paused, reducedMotion, visible, index, goTo]);

  if (count === 0) return null;

  return (
    <section
      ref={rootRef}
      className={styles.slider}
      aria-roledescription={count > 1 ? "carousel" : undefined}
      aria-label="おすすめ"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // キーボード操作でのフォーカス中だけ止める。矢印・ドットをマウスで
      // クリックした後もフォーカスが残るため、それでは止めない。
      onFocus={(e) => {
        try {
          if (e.target.matches(":focus-visible")) setFocused(true);
        } catch {
          setFocused(true);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      onTouchStart={() => setTouching(true)}
      onTouchEnd={() => setTouching(false)}
      onTouchCancel={() => setTouching(false)}
    >
      <div ref={trackRef} className={styles.track} onScroll={count > 1 ? onScroll : undefined}>
        {banners.map((b, i) => (
          <div
            key={b.id}
            className={styles.slide}
            role={count > 1 ? "group" : undefined}
            aria-roledescription={count > 1 ? "slide" : undefined}
            aria-label={count > 1 ? `${i + 1} / ${count}` : undefined}
          >
            <BannerImage banner={b} index={i} />
          </div>
        ))}
      </div>
      {count > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.prev}`}
            aria-label="前のバナー"
            onClick={() => goTo(index - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.next}`}
            aria-label="次のバナー"
            onClick={() => goTo(index + 1)}
          >
            ›
          </button>
          <div className={styles.dots}>
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
                aria-label={`${i + 1}枚目のバナーを表示`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
